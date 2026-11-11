# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for starting an OpenID Connect login and exposing it in the instance config."""

from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import pytest
from django.core.cache import cache
from django.test import Client
from django.urls import reverse
from django.utils import timezone

from plane.authentication.provider.oauth.oidc import OIDCOAuthProvider
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
