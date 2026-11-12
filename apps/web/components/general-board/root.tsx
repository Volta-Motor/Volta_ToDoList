/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { sortBy } from "lodash-es";
import { observer } from "mobx-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { StateGroupIcon } from "@plane/blocks/icons";
import { useTranslation } from "@plane/i18n";
import type { TIssue, TStateGroups } from "@plane/types";
import { cn } from "@plane/utils";
import { useStoryPoints } from "@/components/story-points/use-story-points";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import { GeneralBoardCard } from "./card";
import { FilterChip } from "./filter-chip";
import type { TProjectTag } from "./project-tag";
import { getProjectTag, ProjectTag } from "./project-tag";
import { CLOSED_ITEMS_LIMIT, GENERAL_BOARD_GROUPS, useGeneralBoard } from "./use-general-board";

const ALL = "all";
const UNASSIGNED = "unassigned";

type Props = {
  workspaceSlug: string;
};

export const GeneralBoardRoot = observer(function GeneralBoardRoot(props: Props) {
  const { workspaceSlug } = props;
  // store hooks
  const { joinedProjectIds, getProjectById } = useProject();
  const { getUserDetails } = useMember();
  const { allowPermissions } = useUserPermissions();
  // translation
  const { t } = useTranslation();
  // data
  const {
    items,
    reload,
    isLoading,
    hasError,
    isOpenWorkTruncated,
    hasMoreClosedWork,
    getItemGroup,
    moveItem,
    setAssignees,
  } = useGeneralBoard(workspaceSlug);
  const { isCreateIssueModalOpen } = useCommandPalette();
  const { getStoryPoints, sumStoryPoints } = useStoryPoints(workspaceSlug);
  // state
  const [projectFilter, setProjectFilter] = useState<string>(ALL);
  const [assigneeFilter, setAssigneeFilter] = useState<string>(ALL);
  const [draggedItem, setDraggedItem] = useState<TIssue | undefined>(undefined);
  const [dropTarget, setDropTarget] = useState<TStateGroups | undefined>(undefined);

  // a work item created from the header button shows up once its modal closes
  const wasCreateModalOpen = useRef(false);
  useEffect(() => {
    if (wasCreateModalOpen.current && !isCreateIssueModalOpen) reload();
    wasCreateModalOpen.current = isCreateIssueModalOpen;
  }, [isCreateIssueModalOpen, reload]);

  // every project keeps one tag color, assigned in identifier order
  const projectTags = useMemo(() => {
    const projects = sortBy(
      joinedProjectIds.map((projectId) => getProjectById(projectId)).filter((project) => project !== undefined),
      (project) => project.identifier
    );
    const tags: Record<string, TProjectTag> = {};
    projects.forEach((project, index) => {
      tags[project.id] = getProjectTag(project.identifier, index);
    });
    return { projects, tags };
  }, [joinedProjectIds, getProjectById]);

  // people who have at least one work item on the board, in name order
  const assignees = useMemo(() => {
    const ids = new Set<string>();
    items.forEach((item) => (item.assignee_ids ?? []).forEach((id) => ids.add(id)));
    return sortBy(
      [...ids].map((id) => getUserDetails(id)).filter((user) => user !== undefined),
      (user) => user.display_name.toLocaleLowerCase()
    );
  }, [items, getUserDetails]);

  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        if (projectFilter !== ALL && item.project_id !== projectFilter) return false;
        const assigneeIds = item.assignee_ids ?? [];
        if (assigneeFilter === UNASSIGNED) return assigneeIds.length === 0;
        if (assigneeFilter !== ALL) return assigneeIds.includes(assigneeFilter);
        return true;
      }),
    [items, projectFilter, assigneeFilter]
  );

  const itemsByGroup = useMemo(() => {
    const grouped = Object.fromEntries(GENERAL_BOARD_GROUPS.map((group) => [group, [] as TIssue[]])) as Record<
      TStateGroups,
      TIssue[]
    >;
    visibleItems.forEach((item) => {
      const group = getItemGroup(item);
      if (group && grouped[group]) grouped[group].push(item);
    });
    return grouped;
  }, [visibleItems, getItemGroup]);

  const canEdit = (projectId: string | null | undefined) =>
    Boolean(projectId) &&
    allowPermissions(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      EUserPermissionsLevel.PROJECT,
      workspaceSlug,
      projectId ?? undefined
    );

  const handleDrop = (group: TStateGroups) => {
    const item = draggedItem;
    setDraggedItem(undefined);
    setDropTarget(undefined);
    if (item) void moveItem(item, group);
  };

  if (hasError)
    return (
      <div className="flex h-full items-center justify-center p-6 text-body-sm-regular text-secondary">
        {t("general_board.load_failed")}
      </div>
    );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-1">
      <div className="flex flex-shrink-0 flex-col gap-2 border-b border-subtle px-5 py-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("general_board.project")}>
          <span className="w-16 text-caption-sm-medium tracking-wide text-tertiary uppercase">
            {t("general_board.project")}
          </span>
          <FilterChip isSelected={projectFilter === ALL} onClick={() => setProjectFilter(ALL)}>
            {t("general_board.all")}
          </FilterChip>
          {projectTags.projects.map((project) => (
            <FilterChip
              key={project.id}
              isSelected={projectFilter === project.id}
              onClick={() => setProjectFilter(project.id)}
            >
              <ProjectTag tag={projectTags.tags[project.id]} />
              {project.name}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("general_board.assignee")}>
          <span className="w-16 text-caption-sm-medium tracking-wide text-tertiary uppercase">
            {t("general_board.assignee")}
          </span>
          <FilterChip isSelected={assigneeFilter === ALL} onClick={() => setAssigneeFilter(ALL)}>
            {t("general_board.all")}
          </FilterChip>
          {assignees.map((user) => (
            <FilterChip
              key={user.id}
              isSelected={assigneeFilter === user.id}
              onClick={() => setAssigneeFilter(user.id)}
            >
              {user.display_name}
            </FilterChip>
          ))}
          <FilterChip isSelected={assigneeFilter === UNASSIGNED} onClick={() => setAssigneeFilter(UNASSIGNED)}>
            {t("general_board.unassigned")}
          </FilterChip>
        </div>
        {(isOpenWorkTruncated || hasMoreClosedWork) && (
          <p className="text-caption-sm-regular text-tertiary">
            {isOpenWorkTruncated
              ? t("general_board.open_work_truncated")
              : t("general_board.closed_work_limited", { count: CLOSED_ITEMS_LIMIT })}
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto px-5 py-4">
        {GENERAL_BOARD_GROUPS.map((group) => {
          const groupItems = itemsByGroup[group];
          const groupPoints = sumStoryPoints(groupItems);
          return (
            <section
              key={group}
              aria-label={t(`general_board.groups.${group}`)}
              onDragOver={(event) => {
                if (!draggedItem) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (dropTarget !== group) setDropTarget(group);
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(group);
              }}
              className={cn(
                "flex w-72 flex-shrink-0 flex-col rounded-lg border-2 border-transparent bg-layer-1",
                dropTarget === group && "border-dashed border-accent-strong"
              )}
            >
              <header className="flex flex-shrink-0 items-center gap-2 px-3 py-2.5">
                <StateGroupIcon stateGroup={group} />
                <h2 className="text-body-sm-medium text-primary">{t(`general_board.groups.${group}`)}</h2>
                <span className="text-body-xs-medium text-tertiary">{groupItems.length}</span>
                {groupPoints > 0 && (
                  <span
                    title={t("story_points.column_total")}
                    className="ml-auto text-caption-sm-medium whitespace-nowrap text-secondary"
                  >
                    {t("story_points.value", { points: groupPoints })}
                  </span>
                )}
              </header>
              <div className="vertical-scrollbar scrollbar-sm flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {groupItems.map((item) => (
                  <GeneralBoardCard
                    key={item.id}
                    item={item}
                    workspaceSlug={workspaceSlug}
                    projectTag={projectTags.tags[item.project_id ?? ""] ?? getProjectTag("?", 0)}
                    storyPoints={getStoryPoints(item)}
                    isEditable={canEdit(item.project_id)}
                    isDragging={draggedItem?.id === item.id}
                    onDragStart={setDraggedItem}
                    onDragEnd={() => {
                      setDraggedItem(undefined);
                      setDropTarget(undefined);
                    }}
                    onAssigneesChange={(target, assigneeIds) => void setAssignees(target, assigneeIds)}
                  />
                ))}
                {groupItems.length === 0 && (
                  <p className="rounded-md border border-dashed border-subtle px-3 py-4 text-center text-caption-sm-regular text-tertiary">
                    {isLoading ? t("general_board.loading") : t("general_board.empty_column")}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
});
