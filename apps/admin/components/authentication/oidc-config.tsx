/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
// icons
import { PreferencesOutline } from "@makeplane/propel/icons";
// plane internal packages
import { AnchorButton } from "@makeplane/propel/components/anchor-button";
import { Button } from "@makeplane/propel/components/button";
import { Icon } from "@makeplane/propel/components/icon";
import { Switch } from "@makeplane/propel/components/switch";
import type { TInstanceAuthenticationMethodKeys } from "@plane/types";
// hooks
import { useInstance } from "@/hooks/store";

type Props = {
  disabled: boolean;
  updateConfig: (key: TInstanceAuthenticationMethodKeys, value: string) => void;
};

export const OIDCConfiguration = observer(function OIDCConfiguration(props: Props) {
  const { disabled, updateConfig } = props;
  // store
  const { formattedConfig } = useInstance();
  // derived values
  const isOIDCEnabled = formattedConfig?.IS_OIDC_ENABLED === "1";
  // the client secret is optional: public clients sign in with PKCE alone
  const OIDCConfigured = !!formattedConfig?.OIDC_ISSUER_URL && !!formattedConfig?.OIDC_CLIENT_ID;

  return (
    <>
      {OIDCConfigured ? (
        <div className="flex items-center gap-4">
          <AnchorButton variant="primary" size="sm" render={<Link href="/authentication/oidc" />} label="Edit" />
          <Switch
            checked={isOIDCEnabled}
            onCheckedChange={() => {
              updateConfig("IS_OIDC_ENABLED", isOIDCEnabled ? "0" : "1");
            }}
            size="sm"
            aria-label="Enable OpenID Connect"
            disabled={disabled}
          />
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          stretch="auto"
          nativeButton={false}
          render={<Link href="/authentication/oidc" />}
          icon={<Icon icon={PreferencesOutline} tint="tertiary" />}
          label="Configure"
        />
      )}
    </>
  );
});
