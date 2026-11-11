/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { BoardOutline } from "@makeplane/propel/icons";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { Header } from "@plane/blocks/layout";
import { useTranslation } from "@plane/i18n";
import { EIssuesStoreType } from "@plane/types";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";

export const GeneralBoardHeader = observer(function GeneralBoardHeader() {
  // store hooks
  const { toggleCreateIssueModal } = useCommandPalette();
  // translation
  const { t } = useTranslation();

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs>
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label={t("general_board.title")}
                icon={<BoardOutline className="size-4 text-tertiary" />}
              />
            }
          />
        </Breadcrumbs>
      </Header.LeftItem>
      <Header.RightItem>
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          label={t("issue.new")}
          onClick={() => toggleCreateIssueModal(true, EIssuesStoreType.PROJECT)}
        />
      </Header.RightItem>
    </Header>
  );
});
