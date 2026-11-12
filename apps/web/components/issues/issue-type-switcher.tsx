/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
// store hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// components
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
import { WorkItemTypeSelect } from "@/components/work-item-types/type-select";

export type TIssueTypeSwitcherProps = {
  issueId: string;
  disabled: boolean;
};

export const IssueTypeSwitcher = observer(function IssueTypeSwitcher(props: TIssueTypeSwitcherProps) {
  const { issueId, disabled } = props;
  // router
  const { workspaceSlug } = useParams();
  // translation
  const { t } = useTranslation();
  // store hooks
  const {
    issue: { getIssueById },
    updateIssue,
  } = useIssueDetail();
  // derived values
  const issue = getIssueById(issueId);

  if (!issue || !issue.project_id) return <></>;

  const projectId = issue.project_id;

  const handleTypeChange = async (typeId: string) => {
    if (!workspaceSlug) return;
    try {
      await updateIssue(workspaceSlug.toString(), projectId, issueId, { type_id: typeId });
    } catch {
      setToast({ type: "error", title: t("work_item_types.update_error") });
    }
  };

  return (
    <>
      <IssueIdentifier issueId={issueId} projectId={projectId} size="md" enableClickToCopyIdentifier />
      {workspaceSlug && (
        <WorkItemTypeSelect
          workspaceSlug={workspaceSlug.toString()}
          value={issue.type_id}
          onChange={(typeId) => void handleTypeChange(typeId)}
          disabled={disabled}
        />
      )}
    </>
  );
});
