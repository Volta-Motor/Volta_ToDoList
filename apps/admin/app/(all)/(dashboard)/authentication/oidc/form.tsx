/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isEmpty } from "lodash-es";
// plane internal packages
import { API_BASE_URL } from "@plane/constants";
import type { IFormattedInstanceConfiguration, TInstanceOIDCAuthenticationConfigurationKeys } from "@plane/types";
// components
import { CodeBlock } from "@/components/common/code-block";
import type { TControllerInputFormField } from "@/components/common/controller-input";
import type { TControllerSwitchFormField } from "@/components/common/controller-switch";
import type { TCopyField } from "@/components/common/copy-field";
import { OAuthProviderForm } from "@/components/authentication/oauth-provider-form";
// hooks
import { useOAuthProviderConfigForm } from "@/hooks/use-oauth-provider-config-form";

type Props = {
  config: IFormattedInstanceConfiguration;
};

type OIDCConfigFormValues = Record<TInstanceOIDCAuthenticationConfigurationKeys, string>;

const OIDC_FORM_SWITCH_FIELD: TControllerSwitchFormField<OIDCConfigFormValues> = {
  name: "ENABLE_OIDC_SYNC",
  label: "OpenID Connect",
};

export function InstanceOIDCConfigForm(props: Props) {
  const { config } = props;
  // form data
  const {
    control,
    formState: { errors },
    onSave,
  } = useOAuthProviderConfigForm<OIDCConfigFormValues>("OpenID Connect", {
    OIDC_PROVIDER_NAME: config["OIDC_PROVIDER_NAME"] || "",
    OIDC_ISSUER_URL: config["OIDC_ISSUER_URL"] || "",
    OIDC_CLIENT_ID: config["OIDC_CLIENT_ID"] || "",
    OIDC_CLIENT_SECRET: config["OIDC_CLIENT_SECRET"] || "",
    ENABLE_OIDC_SYNC: config["ENABLE_OIDC_SYNC"] || "0",
  });

  const originURL = !isEmpty(API_BASE_URL) ? API_BASE_URL : typeof window !== "undefined" ? window.location.origin : "";

  const OIDC_FORM_FIELDS: TControllerInputFormField<OIDCConfigFormValues>[] = [
    {
      key: "OIDC_PROVIDER_NAME",
      type: "text",
      label: "Provider name",
      description: <>Shown on the login button, for example &quot;Continue with Zitadel&quot;.</>,
      placeholder: "Zitadel",
      error: Boolean(errors.OIDC_PROVIDER_NAME),
      required: false,
    },
    {
      key: "OIDC_ISSUER_URL",
      type: "text",
      label: "Issuer URL",
      description: (
        <>
          The base URL of your identity provider. The endpoints are read from{" "}
          <CodeBlock darkerShade>/.well-known/openid-configuration</CodeBlock> under this address.
        </>
      ),
      placeholder: "https://login.example.com",
      error: Boolean(errors.OIDC_ISSUER_URL),
      required: true,
    },
    {
      key: "OIDC_CLIENT_ID",
      type: "text",
      label: "Client ID",
      description: <>The client ID of the application you created at your identity provider.</>,
      placeholder: "281474976710657",
      error: Boolean(errors.OIDC_CLIENT_ID),
      required: true,
    },
    {
      key: "OIDC_CLIENT_SECRET",
      type: "password",
      label: "Client secret",
      description: (
        <>
          Leave empty if the application uses PKCE without a secret. When set, the secret is sent with HTTP Basic
          authentication.
        </>
      ),
      placeholder: "Optional",
      error: Boolean(errors.OIDC_CLIENT_SECRET),
      required: false,
    },
  ];

  const OIDC_SERVICE_FIELD: TCopyField[] = [
    {
      key: "Callback_URI",
      label: "Redirect URI",
      url: `${originURL}/auth/oidc/callback/`,
      description: (
        <>
          We will auto-generate this. Add it to the <CodeBlock darkerShade>Redirect URIs</CodeBlock> of the application
          at your identity provider.
        </>
      ),
    },
  ];

  return (
    <OAuthProviderForm
      providerName="OpenID Connect"
      control={control}
      formFields={OIDC_FORM_FIELDS}
      switchField={OIDC_FORM_SWITCH_FIELD}
      onSave={onSave}
      serviceDetails={OIDC_SERVICE_FIELD}
    />
  );
}
