/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
// plane imports
import { PriorityIcon } from "@plane/blocks/icons";
import { useTranslation } from "@plane/i18n";
import type { TIssue } from "@plane/types";
import { cn, generateWorkItemLink } from "@plane/utils";
// components
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { WorkItemTypeBadge } from "@/components/work-item-types/type-badge";
import { useWorkItemTypes } from "@/components/work-item-types/use-work-item-types";
// hooks
import { useProject } from "@/hooks/store/use-project";
// local imports
import type { TProjectTag } from "./project-tag";
import { ProjectTag } from "./project-tag";

type Props = {
  item: TIssue;
  workspaceSlug: string;
  projectTag: TProjectTag;
  /** Story points of the work item, when it has any. */
  storyPoints: number | undefined;
  isEditable: boolean;
  isDragging: boolean;
  onDragStart: (item: TIssue) => void;
  onDragEnd: () => void;
  onAssigneesChange: (item: TIssue, assigneeIds: string[]) => void;
};

export const GeneralBoardCard = observer(function GeneralBoardCard(props: Props) {
  const {
    item,
    workspaceSlug,
    projectTag,
    storyPoints,
    isEditable,
    isDragging,
    onDragStart,
    onDragEnd,
    onAssigneesChange,
  } = props;
  // store hooks
  const { getProjectById } = useProject();
  // translation
  const { t, currentLocale } = useTranslation();
  // data
  const { getTypeById } = useWorkItemTypes(workspaceSlug);
  // derived values
  const project = getProjectById(item.project_id);
  const workItemType = getTypeById(item.type_id);
  const workItemKey = `${project?.identifier ?? ""}-${item.sequence_id}`;
  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: item.project_id,
    issueId: item.id,
    projectIdentifier: project?.identifier,
    sequenceId: item.sequence_id,
  });
  const priority = item.priority && item.priority !== "none" ? item.priority : undefined;
  const targetDate = item.target_date
    ? new Intl.DateTimeFormat(currentLocale, { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(item.target_date)
      )
    : undefined;

  return (
    <article
      draggable={isEditable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
        onDragStart(item);
      }}
      onDragEnd={onDragEnd}
      // the left edge carries the project's color, so a column reads by project at a glance
      style={{ borderLeftColor: projectTag.border }}
      className={cn(
        "flex flex-col gap-2.5 rounded-md border border-l-4 border-subtle bg-surface-1 p-3 shadow-raised-100",
        "transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-raised-200",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        isEditable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-center gap-2">
        <ProjectTag tag={projectTag} title={project?.name} />
        {workItemType && <WorkItemTypeBadge type={workItemType} className="text-caption-sm-medium text-secondary" />}
        <span className="ml-auto text-caption-sm-regular whitespace-nowrap text-tertiary">{workItemKey}</span>
      </div>

      <Link
        href={workItemLink}
        draggable={false}
        className="text-body-sm-medium break-words text-primary hover:text-accent-primary hover:underline"
      >
        {item.name}
      </Link>

      {(priority || targetDate || storyPoints !== undefined) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption-sm-regular text-secondary">
          {priority && (
            <span className="inline-flex items-center gap-1">
              <PriorityIcon priority={priority} className="size-3.5" />
              {t(`issue.priority.${priority}`)}
            </span>
          )}
          {storyPoints !== undefined && (
            <span
              title={t("story_points.label")}
              className="rounded-full bg-accent-subtle px-2 py-0.5 text-caption-sm-semibold whitespace-nowrap text-accent-primary"
            >
              {t("story_points.value", { points: storyPoints })}
            </span>
          )}
          {targetDate && <span className="ml-auto whitespace-nowrap">{targetDate}</span>}
        </div>
      )}

      <div className="border-t border-subtle pt-2">
        <MemberSelect
          projectId={item.project_id ?? undefined}
          value={item.assignee_ids ?? []}
          onChange={(assigneeIds) => onAssigneesChange(item, assigneeIds)}
          disabled={!isEditable}
          multiple
          variant="pill-md"
          showLabel
          placeholder={t("general_board.unassigned")}
          multipleLabel={(count) => t("general_board.assignee_count", { count })}
          tooltip={{ heading: t("general_board.assignee") }}
        />
      </div>
    </article>
  );
});
