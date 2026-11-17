/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
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
import { useProject } from "@/hooks/store/use-project";

export const GeneralBoardHeader = observer(function GeneralBoardHeader() {
  // router: the project's own board carries the project in the address
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { toggleCreateIssueModal } = useCommandPalette();
  const { getProjectById } = useProject();
  // translation
  const { t } = useTranslation();
  // derived values
  const project = projectId ? getProjectById(projectId.toString()) : undefined;

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs>
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label={t("general_board.title")}
                href={project ? `/${workspaceSlug?.toString()}/board` : undefined}
                icon={<BoardOutline className="size-4 text-tertiary" />}
              />
            }
          />
          {project && <Breadcrumbs.Item component={<BreadcrumbLink label={project.name} />} />}
        </Breadcrumbs>
      </Header.LeftItem>
      <Header.RightItem>
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          label={t("issue.new")}
          // on a project's board the new work item is opened for that project
          onClick={() => toggleCreateIssueModal(true, EIssuesStoreType.PROJECT, project ? [project.id] : undefined)}
        />
      </Header.RightItem>
    </Header>
  );
});
