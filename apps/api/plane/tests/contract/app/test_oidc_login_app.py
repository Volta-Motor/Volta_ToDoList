# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for starting an OpenID Connect login and exposing it in the instance config."""

from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pytest
from django.core.cache import cache
from django.test import Client
from django.urls import reverse
from django.utils import timezone

from plane.authentication.provider.oauth.oidc import OIDCOAuthProvider
from plane.db.models import Account, Profile, User
from plane.license.models import Instance, InstanceConfiguration

ISSUER = "https://login.example.com"
ENDPOINTS = {
    "authorization_endpoint": f"{ISSUER}/oauth/v2/authorize",
    "token_endpoint": f"{ISSUER}/oauth/v2/token",
    "userinfo_endpoint": f"{ISSUER}/oidc/v1/userinfo",
}


@pytest.fixture
def instance(db):
    return Instance.objects.create(
        instance_name="Test Instance",
        instance_id="test-instance-id",
        current_version="1.0.0",
        last_checked_at=timezone.now(),
        is_setup_done=True,
    )


def _configure(**values):
    for key, value in values.items():
        InstanceConfiguration.objects.update_or_create(key=key, defaults={"value": value, "is_encrypted": False})


@pytest.mark.contract
@pytest.mark.django_db
class TestOIDCInitiate:
    def test_redirects_to_the_issuer_and_stores_state_and_verifier(self, instance):
        _configure(OIDC_ISSUER_URL=ISSUER, OIDC_CLIENT_ID="client-id")
        client = Client()

        with patch.object(OIDCOAuthProvider, "discover", return_value=ENDPOINTS):
            response = client.get(reverse("oidc-initiate"))

        assert response.status_code == 302
        location = urlparse(response.url)
        assert f"{location.scheme}://{location.netloc}{location.path}" == ENDPOINTS["authorization_endpoint"]
        params = parse_qs(location.query)
        assert params["client_id"] == ["client-id"]
        assert params["state"] == [client.session["state"]]
        assert params["code_challenge_method"] == ["S256"]
        verifier = client.session["oidc_code_verifier"]
        assert params["code_challenge"] == [OIDCOAuthProvider.get_code_challenge(verifier)]
        assert verifier not in response.url

    def test_unconfigured_provider_redirects_back_with_an_error(self, instance):
        client = Client()

        with patch.object(OIDCOAuthProvider, "discover") as discover:
            response = client.get(reverse("oidc-initiate"))

        assert response.status_code == 302
        assert "error_code=5113" in response.url
        discover.assert_not_called()
        assert "oidc_code_verifier" not in client.session

    def test_instance_that_is_not_set_up_is_refused(self, db):
        response = Client().get(reverse("oidc-initiate"))

        assert response.status_code == 302
        assert "error_code" in response.url


@pytest.mark.contract
@pytest.mark.django_db
class TestInstanceConfigExposesOIDC:
    @pytest.fixture(autouse=True)
    def _fresh_instance_cache(self):
        # The instance endpoint caches its response; each test needs its own read.
        cache.clear()
        yield
        cache.clear()

    def test_disabled_by_default(self, instance):
        response = Client().get(reverse("instance"))

        assert response.status_code == 200
        assert response.json()["config"]["is_oidc_enabled"] is False
        assert response.json()["config"]["oidc_provider_name"] == ""

    def test_enabled_with_provider_name(self, instance):
        _configure(IS_OIDC_ENABLED="1", OIDC_PROVIDER_NAME="Zitadel")

        response = Client().get(reverse("instance"))

        assert response.json()["config"]["is_oidc_enabled"] is True
        assert response.json()["config"]["oidc_provider_name"] == "Zitadel"


# What a Zitadel userinfo response looks like for a user without a profile picture.
USERINFO = {
    "sub": "289123456789",
    "name": "Ada Lovelace",
    "given_name": "Ada",
    "family_name": "Lovelace",
    "locale": "tr",
    "preferred_username": "ada@volta.example.com",
    "email": "Ada.Lovelace@example.com",
    "email_verified": True,
}
TOKEN = {"access_token": "access-token", "token_type": "Bearer", "expires_in": 43199, "id_token": "id-token"}


def _json_response(payload):
    response = MagicMock()
    response.json.return_value = payload
    response.raise_for_status.return_value = None
    return response


def _complete_login(userinfo):
    """Start a login and come back from the provider with the given userinfo."""
    client = Client(HTTP_USER_AGENT="Mozilla/5.0 (contract test)")
    with patch.object(OIDCOAuthProvider, "discover", return_value=ENDPOINTS):
        start = client.get(reverse("oidc-initiate"))
        state = parse_qs(urlparse(start.url).query)["state"][0]
        with (
            patch("plane.authentication.adapter.oauth.requests.post", return_value=_json_response(TOKEN)),
            patch("plane.authentication.adapter.oauth.requests.get", return_value=_json_response(userinfo)),
        ):
            response = client.get(reverse("oidc-callback"), {"code": "authorization-code", "state": state})
    return client, response


def _error_code(response):
    return parse_qs(urlparse(response.url).query).get("error_code")


@pytest.mark.contract
@pytest.mark.django_db
class TestOIDCCallback:
    """The whole way back from the provider: token exchange, userinfo, account, session."""

    @pytest.fixture(autouse=True)
    def _configured(self, instance):
        _configure(OIDC_ISSUER_URL=ISSUER, OIDC_CLIENT_ID="client-id")

    def test_first_login_creates_the_user_and_signs_in(self):
        client, response = _complete_login(USERINFO)

        assert response.status_code == 302
        assert _error_code(response) is None
        user = User.objects.get(email="ada.lovelace@example.com")
        assert (user.first_name, user.last_name) == ("Ada", "Lovelace")
        assert user.is_email_verified is True
        assert user.avatar == ""
        assert user.last_login_medium == "oidc"
        assert Account.objects.filter(user=user, provider="oidc", provider_account_id="289123456789").exists()
        assert client.session["_auth_user_id"] == str(user.id)

    def test_existing_user_is_matched_by_email(self):
        existing = User.objects.create(email="ada.lovelace@example.com", username="ada")
        Profile.objects.create(user=existing)

        client, response = _complete_login(USERINFO)

        assert _error_code(response) is None
        assert User.objects.filter(email="ada.lovelace@example.com").count() == 1
        assert client.session["_auth_user_id"] == str(existing.id)

    def test_profile_sync_without_a_picture(self):
        # Zitadel sends no `picture` for a user without one. With sync on this used to write NULL
        # into the avatar column of an existing user and answer 500.
        _configure(ENABLE_OIDC_SYNC="1")
        existing = User.objects.create(email="ada.lovelace@example.com", username="ada", first_name="Old")
        Profile.objects.create(user=existing)

        client, response = _complete_login(USERINFO)

        assert response.status_code == 302
        assert _error_code(response) is None
        existing.refresh_from_db()
        assert existing.first_name == "Ada"
        assert existing.avatar == ""
        assert client.session["_auth_user_id"] == str(existing.id)

    def test_unverified_email_is_refused(self):
        client, response = _complete_login({**USERINFO, "email_verified": False})

        assert _error_code(response) is not None
        assert not User.objects.exists()
        assert "_auth_user_id" not in client.session

    @pytest.mark.parametrize(
        "email", ["zitadel-admin@zitadel.192.168.1.240", "ada@intranet", "ada lovelace@example.com"]
    )
    def test_address_that_is_not_an_email_is_refused(self, email):
        # e.g. the built-in admin of a Zitadel installed under an IP address
        client, response = _complete_login({**USERINFO, "email": email})

        assert _error_code(response) == ["5005"]
        assert not User.objects.exists()
        assert "_auth_user_id" not in client.session
