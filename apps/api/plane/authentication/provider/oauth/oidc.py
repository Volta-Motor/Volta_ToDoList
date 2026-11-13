# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import base64
import hashlib
import os
import secrets
from datetime import datetime, timedelta
from urllib.parse import quote_plus, urlencode, urlparse

# Third party imports
import pytz
import requests

# Django imports
from django.core.cache import cache

# Module imports
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)
from plane.authentication.adapter.oauth import OauthAdapter
from plane.license.utils.instance_value import get_configuration_value


class OIDCOAuthProvider(OauthAdapter):
    """Generic OpenID Connect login (authorization code flow with PKCE).

    Works with any provider that publishes a discovery document, such as Zitadel or Keycloak.
    The client secret is optional: without it the provider is treated as a public client and
    PKCE alone protects the code exchange.
    """

    provider = "oidc"
    scope = "openid email profile"
    discovery_path = "/.well-known/openid-configuration"
    discovery_cache_ttl = 60 * 60
    request_timeout = 10

    def __init__(self, request, code=None, state=None, callback=None, code_verifier=None):
        (OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_ISSUER_URL) = get_configuration_value(
            [
                {
                    "key": "OIDC_CLIENT_ID",
                    "default": os.environ.get("OIDC_CLIENT_ID"),
                },
                {
                    "key": "OIDC_CLIENT_SECRET",
                    "default": os.environ.get("OIDC_CLIENT_SECRET"),
                },
                {
                    "key": "OIDC_ISSUER_URL",
                    "default": os.environ.get("OIDC_ISSUER_URL"),
                },
            ]
        )

        if not (OIDC_CLIENT_ID and OIDC_ISSUER_URL):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"],
                error_message="OIDC_NOT_CONFIGURED",
            )

        # Enforce scheme and normalize trailing slash(es)
        parsed = urlparse(OIDC_ISSUER_URL)
        if parsed.scheme not in ("https", "http") or not parsed.netloc:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"],
                error_message="OIDC_NOT_CONFIGURED",  # avoid leaking details to query params
            )
        issuer = OIDC_ISSUER_URL.rstrip("/")

        endpoints = self.discover(issuer)
        self.code_verifier = code_verifier

        client_id = OIDC_CLIENT_ID
        client_secret = OIDC_CLIENT_SECRET or None

        redirect_uri = f"{'https' if request.is_secure() else 'http'}://{request.get_host()}/auth/oidc/callback/"
        url_params = {
            "client_id": client_id,
            "scope": self.scope,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "state": state,
        }
        if code_verifier:
            url_params["code_challenge"] = self.get_code_challenge(code_verifier)
            url_params["code_challenge_method"] = "S256"
        separator = "&" if urlparse(endpoints["authorization_endpoint"]).query else "?"
        auth_url = f"{endpoints['authorization_endpoint']}{separator}{urlencode(url_params)}"

        super().__init__(
            request,
            self.provider,
            client_id,
            self.scope,
            redirect_uri,
            auth_url,
            endpoints["token_endpoint"],
            endpoints["userinfo_endpoint"],
            client_secret,
            code,
            callback=callback,
        )

    @staticmethod
    def generate_code_verifier():
        return secrets.token_urlsafe(64)

    @staticmethod
    def get_code_challenge(code_verifier):
        digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")

    @classmethod
    def discover(cls, issuer):
        """Return the authorization, token and userinfo endpoints the issuer publishes."""
        cache_key = f"oidc_discovery:{hashlib.sha256(issuer.encode()).hexdigest()}"
        endpoints = cache.get(cache_key)
        if endpoints:
            return endpoints

        try:
            response = requests.get(
                f"{issuer}{cls.discovery_path}",
                headers={"Accept": "application/json"},
                timeout=cls.request_timeout,
            )
            response.raise_for_status()
            document = response.json()
        except (requests.RequestException, ValueError):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message="OIDC_OAUTH_PROVIDER_ERROR",
            )

        if not isinstance(document, dict):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message="OIDC_OAUTH_PROVIDER_ERROR",
            )

        # The discovery document must describe the issuer it was fetched from
        if str(document.get("issuer") or "").rstrip("/") != issuer:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message="OIDC_OAUTH_PROVIDER_ERROR",
            )

        endpoints = {
            key: document.get(key) for key in ("authorization_endpoint", "token_endpoint", "userinfo_endpoint")
        }
        for value in endpoints.values():
            parsed = urlparse(str(value or ""))
            if parsed.scheme not in ("https", "http") or not parsed.netloc:
                raise AuthenticationException(
                    error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                    error_message="OIDC_OAUTH_PROVIDER_ERROR",
                )

        cache.set(cache_key, endpoints, cls.discovery_cache_ttl)
        return endpoints

    def set_token_data(self):
        data = {
            "code": self.code,
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
        }
        if self.code_verifier:
            data["code_verifier"] = self.code_verifier

        headers = {"Accept": "application/json"}
        if self.client_secret:
            # client_secret_basic: the method every OpenID Connect provider has to support
            credentials = f"{quote_plus(self.client_id)}:{quote_plus(self.client_secret)}"
            headers["Authorization"] = f"Basic {base64.b64encode(credentials.encode()).decode()}"

        token_response = self.get_user_token(data=data, headers=headers)
        super().set_token_data(
            {
                "access_token": token_response.get("access_token"),
                "refresh_token": token_response.get("refresh_token", None),
                "access_token_expired_at": (
                    datetime.now(tz=pytz.utc) + timedelta(seconds=token_response.get("expires_in"))
                    if token_response.get("expires_in")
                    else None
                ),
                "refresh_token_expired_at": None,
                "id_token": token_response.get("id_token", ""),
            }
        )

    def set_user_data(self):
        user_info_response = self.get_user_response()

        subject = user_info_response.get("sub")
        email = user_info_response.get("email")
        if not subject or not email:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message="OIDC_OAUTH_PROVIDER_ERROR",
            )

        # Never accept an unverified email: accounts are matched by email, so an identity
        # provider that lets users assert any address could take over an existing account.
        email_verified = user_info_response.get("email_verified")
        if not (email_verified is True or email_verified == "true"):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OAUTH_PROVIDER_UNVERIFIED_EMAIL"],
                error_message="OAUTH_PROVIDER_UNVERIFIED_EMAIL",
            )

        first_name = (
            user_info_response.get("given_name")
            or user_info_response.get("name")
            or user_info_response.get("preferred_username")
            or ""
        )

        super().set_user_data(
            {
                "email": email,
                "user": {
                    "provider_id": str(subject),
                    "email": email,
                    # `picture` is optional. The user's avatar column does not take NULL, and the
                    # profile sync writes this value to it as is, so "no picture" is an empty string.
                    "avatar": user_info_response.get("picture") or "",
                    "first_name": first_name,
                    "last_name": user_info_response.get("family_name") or "",
                    "is_password_autoset": True,
                },
            }
        )
