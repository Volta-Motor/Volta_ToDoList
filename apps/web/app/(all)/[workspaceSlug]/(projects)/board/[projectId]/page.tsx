/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
// components
import { PageHead } from "@/components/core/page-title";
import { GeneralBoardRoot } from "@/components/general-board/root";
// hooks
import { useProject } from "@/hooks/store/use-project";

/** The board of one project: the same board as the general one, with only that project's work. */
const ProjectBoardPage = observer(function ProjectBoardPage() {
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { getProjectById } = useProject();
  // translation
  const { t } = useTranslation();

  if (!workspaceSlug || !projectId) return null;

  const project = getProjectById(projectId.toString());

  return (
    <>
      <PageHead title={project ? `${project.name} - ${t("general_board.title")}` : t("general_board.title")} />
      {/* keyed by project so filters and drag state start fresh when switching projects */}
      <GeneralBoardRoot
        key={projectId.toString()}
        workspaceSlug={workspaceSlug.toString()}
        projectId={projectId.toString()}
      />
    </>
  );
});

export default ProjectBoardPage;
