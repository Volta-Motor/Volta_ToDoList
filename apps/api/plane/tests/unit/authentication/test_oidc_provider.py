# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Unit tests for the generic OpenID Connect login provider."""

import base64
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pytest
import requests
from django.test import RequestFactory

from plane.authentication.adapter.error import AUTHENTICATION_ERROR_CODES, AuthenticationException
from plane.authentication.provider.oauth.oidc import OIDCOAuthProvider

MODULE = "plane.authentication.provider.oauth.oidc"
ISSUER = "https://login.example.com"
DISCOVERY = {
    "issuer": ISSUER,
    "authorization_endpoint": f"{ISSUER}/oauth/v2/authorize",
    "token_endpoint": f"{ISSUER}/oauth/v2/token",
    "userinfo_endpoint": f"{ISSUER}/oidc/v1/userinfo",
}


def _json_response(payload):
    response = MagicMock()
    response.json.return_value = payload
    response.raise_for_status.return_value = None
    return response


def _provider(config=("client-id", "client-secret", ISSUER), discovery=None, **kwargs):
    """Build a provider with the instance configuration and the discovery request mocked."""
    request = RequestFactory().get("/auth/oidc/", secure=True, HTTP_HOST="todo.example.com")
    with (
        patch(f"{MODULE}.get_configuration_value", return_value=config),
        patch(f"{MODULE}.cache") as cache,
        patch(f"{MODULE}.requests.get", return_value=_json_response(discovery or DISCOVERY)) as discovery_get,
    ):
        cache.get.return_value = None
        provider = OIDCOAuthProvider(request=request, **kwargs)
    provider.discovery_get = discovery_get
    return provider


def _error_code(excinfo):
    return excinfo.value.error_code


@pytest.mark.unit
class TestOIDCConfiguration:
    @pytest.mark.parametrize(
        "config",
        [
            (None, "client-secret", ISSUER),
            ("client-id", "client-secret", None),
            ("client-id", "client-secret", "login.example.com"),
            ("client-id", "client-secret", "ftp://login.example.com"),
        ],
        ids=["no-client-id", "no-issuer", "issuer-without-scheme", "issuer-with-other-scheme"],
    )
    def test_incomplete_configuration_is_refused(self, config):
        with pytest.raises(AuthenticationException) as excinfo:
            _provider(config=config)

        assert _error_code(excinfo) == AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"]

    def test_client_secret_is_optional(self):
        provider = _provider(config=("client-id", None, ISSUER))

        assert provider.client_secret is None

    def test_trailing_slash_on_issuer_is_ignored(self):
        provider = _provider(config=("client-id", None, f"{ISSUER}/"))

        assert provider.discovery_get.call_args.args[0] == f"{ISSUER}/.well-known/openid-configuration"
        assert provider.get_token_url() == DISCOVERY["token_endpoint"]


@pytest.mark.unit
class TestOIDCDiscovery:
    def test_endpoints_come_from_the_discovery_document(self):
        provider = _provider()

        assert provider.get_auth_url().startswith(f"{DISCOVERY['authorization_endpoint']}?")
        assert provider.get_token_url() == DISCOVERY["token_endpoint"]
        assert provider.get_user_info_url() == DISCOVERY["userinfo_endpoint"]

    def test_document_for_another_issuer_is_refused(self):
        with pytest.raises(AuthenticationException) as excinfo:
            _provider(discovery={**DISCOVERY, "issuer": "https://attacker.example.com"})

        assert _error_code(excinfo) == AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"]

    @pytest.mark.parametrize("endpoint", ["authorization_endpoint", "token_endpoint", "userinfo_endpoint"])
    @pytest.mark.parametrize("value", [None, "", "javascript:alert(1)", "/relative/path"])
    def test_missing_or_unsafe_endpoint_is_refused(self, endpoint, value):
        with pytest.raises(AuthenticationException) as excinfo:
            _provider(discovery={**DISCOVERY, endpoint: value})

        assert _error_code(excinfo) == AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"]

    def test_unreachable_issuer_is_reported_as_provider_error(self):
        request = RequestFactory().get("/auth/oidc/")
        with (
            patch(f"{MODULE}.get_configuration_value", return_value=("client-id", None, ISSUER)),
            patch(f"{MODULE}.cache") as cache,
            patch(f"{MODULE}.requests.get", side_effect=requests.ConnectionError()),
        ):
            cache.get.return_value = None
            with pytest.raises(AuthenticationException) as excinfo:
                OIDCOAuthProvider(request=request)

        assert _error_code(excinfo) == AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"]

    def test_cached_endpoints_skip_the_request(self):
        request = RequestFactory().get("/auth/oidc/")
        cached = {key: DISCOVERY[key] for key in ("authorization_endpoint", "token_endpoint", "userinfo_endpoint")}
        with (
            patch(f"{MODULE}.get_configuration_value", return_value=("client-id", None, ISSUER)),
            patch(f"{MODULE}.cache") as cache,
            patch(f"{MODULE}.requests.get") as discovery_get,
        ):
            cache.get.return_value = cached
            provider = OIDCOAuthProvider(request=request)

        discovery_get.assert_not_called()
        assert provider.get_token_url() == DISCOVERY["token_endpoint"]


@pytest.mark.unit
class TestOIDCAuthorizationUrl:
    def test_code_challenge_matches_rfc_7636_example(self):
        verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

        assert OIDCOAuthProvider.get_code_challenge(verifier) == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

    def test_generated_verifiers_are_unique_and_long_enough(self):
        first = OIDCOAuthProvider.generate_code_verifier()
        second = OIDCOAuthProvider.generate_code_verifier()

        assert first != second
        assert 43 <= len(first) <= 128

    def test_authorization_request_carries_state_and_pkce(self):
        verifier = OIDCOAuthProvider.generate_code_verifier()
        provider = _provider(state="state-value", code_verifier=verifier)

        params = parse_qs(urlparse(provider.get_auth_url()).query)

        assert params["client_id"] == ["client-id"]
        assert params["response_type"] == ["code"]
        assert params["scope"] == ["openid email profile"]
        assert params["state"] == ["state-value"]
        assert params["redirect_uri"] == ["https://todo.example.com/auth/oidc/callback/"]
        assert params["code_challenge"] == [OIDCOAuthProvider.get_code_challenge(verifier)]
        assert params["code_challenge_method"] == ["S256"]
        assert verifier not in provider.get_auth_url()


@pytest.mark.unit
class TestOIDCTokenExchange:
    TOKEN_RESPONSE = {"access_token": "access", "id_token": "id", "expires_in": 3600}

    def _exchange(self, provider):
        with patch.object(provider, "get_user_token", return_value=self.TOKEN_RESPONSE) as get_user_token:
            provider.set_token_data()
        return get_user_token.call_args.kwargs

    def test_confidential_client_authenticates_with_basic_header(self):
        provider = _provider(code="auth-code", code_verifier="verifier")

        call = self._exchange(provider)

        expected = base64.b64encode(b"client-id:client-secret").decode()
        assert call["headers"]["Authorization"] == f"Basic {expected}"
        assert "client_secret" not in call["data"]
        assert call["data"]["code"] == "auth-code"
        assert call["data"]["code_verifier"] == "verifier"
        assert call["data"]["grant_type"] == "authorization_code"
        assert call["data"]["redirect_uri"] == "https://todo.example.com/auth/oidc/callback/"

    def test_public_client_relies_on_pkce_only(self):
        provider = _provider(config=("client-id", None, ISSUER), code="auth-code", code_verifier="verifier")

        call = self._exchange(provider)

        assert "Authorization" not in call["headers"]
        assert "client_secret" not in call["data"]
        assert call["data"]["client_id"] == "client-id"
        assert call["data"]["code_verifier"] == "verifier"

    def test_token_data_is_stored(self):
        provider = _provider(code="auth-code")

        self._exchange(provider)

        assert provider.token_data["access_token"] == "access"
        assert provider.token_data["id_token"] == "id"
        assert provider.token_data["access_token_expired_at"] is not None


@pytest.mark.unit
class TestOIDCUserData:
    USER_INFO = {
        "sub": "2841",
        "email": "kisi@example.com",
        "email_verified": True,
        "given_name": "Ada",
        "family_name": "Lovelace",
        "picture": "https://login.example.com/avatar.png",
    }

    def _user_data(self, user_info):
        provider = _provider()
        with patch.object(provider, "get_user_response", return_value=user_info):
            provider.set_user_data()
        return provider.user_data

    def test_verified_user_is_mapped(self):
        data = self._user_data(self.USER_INFO)

        assert data["email"] == "kisi@example.com"
        assert data["user"] == {
            "provider_id": "2841",
            "email": "kisi@example.com",
            "avatar": "https://login.example.com/avatar.png",
            "first_name": "Ada",
            "last_name": "Lovelace",
            "is_password_autoset": True,
        }

    def test_display_name_falls_back_to_name_then_username(self):
        info = {"sub": "1", "email": "a@example.com", "email_verified": True, "name": "Ada Lovelace"}
        assert self._user_data(info)["user"]["first_name"] == "Ada Lovelace"

        info = {"sub": "1", "email": "a@example.com", "email_verified": True, "preferred_username": "ada"}
        assert self._user_data(info)["user"]["first_name"] == "ada"

    @pytest.mark.parametrize("email_verified", [False, None, "false", 1], ids=["false", "missing", "string", "number"])
    def test_unverified_email_is_refused(self, email_verified):
        info = {**self.USER_INFO, "email_verified": email_verified}
        if email_verified is None:
            del info["email_verified"]

        with pytest.raises(AuthenticationException) as excinfo:
            self._user_data(info)

        assert _error_code(excinfo) == AUTHENTICATION_ERROR_CODES["OAUTH_PROVIDER_UNVERIFIED_EMAIL"]

    @pytest.mark.parametrize("missing", ["sub", "email"])
    def test_missing_subject_or_email_is_refused(self, missing):
        info = {key: value for key, value in self.USER_INFO.items() if key != missing}

        with pytest.raises(AuthenticationException) as excinfo:
            self._user_data(info)

        assert _error_code(excinfo) == AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"]
