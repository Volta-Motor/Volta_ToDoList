/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useState } from "react";
import { sortBy } from "lodash-es";
import useSWR from "swr";
// plane imports
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TIssue, TStateGroups } from "@plane/types";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProjectState } from "@/hooks/store/use-project-state";
// local imports
import { CONSULTANT_STATE_MARK } from "./palette";
import type { TBoardColumn } from "./palette";
// services
import { IssueService } from "@/services/issue/issue.service";
import { WorkspaceService } from "@/services/workspace.service";

/** Columns of the board, in display order. */
export const GENERAL_BOARD_GROUPS: TBoardColumn[] = [
  "backlog",
  "unstarted",
  "started",
  "consultant",
  "completed",
  "cancelled",
];

const OPEN_GROUPS: TStateGroups[] = ["backlog", "unstarted", "started"];
const CLOSED_GROUPS: TStateGroups[] = ["completed", "cancelled"];
const OPEN_PAGE_SIZE = 100;
/** Open work is loaded in full up to this many pages; beyond it the board says it is incomplete. */
const OPEN_MAX_PAGES = 10;
/** Closed work never stops growing, so only the most recently updated items are shown. */
export const CLOSED_ITEMS_LIMIT = 50;

const workspaceService = new WorkspaceService();
const issueService = new IssueService();

type TBoardData = {
  items: TIssue[];
  isOpenWorkTruncated: boolean;
  hasMoreClosedWork: boolean;
};

const fetchBoardItems = async (workspaceSlug: string, projectId?: string): Promise<TBoardData> => {
  // a project's own board asks only for that project, so its closed work is not crowded out
  const projectFilter = projectId ? { project: projectId } : {};
  const items: TIssue[] = [];
  let isOpenWorkTruncated = true;

  for (let page = 0; page < OPEN_MAX_PAGES; page++) {
    // Pages are read one after another on purpose: each response says whether another page exists.
    // oxlint-disable-next-line no-await-in-loop
    const response = await workspaceService.getViewIssues(workspaceSlug, {
      ...projectFilter,
      state_group: OPEN_GROUPS.join(","),
      per_page: OPEN_PAGE_SIZE,
      cursor: `${OPEN_PAGE_SIZE}:${page}:0`,
    });
    if (Array.isArray(response?.results)) items.push(...(response.results as TIssue[]));
    if (!response?.next_page_results) {
      isOpenWorkTruncated = false;
      break;
    }
  }

  const closedResponse = await workspaceService.getViewIssues(workspaceSlug, {
    ...projectFilter,
    state_group: CLOSED_GROUPS.join(","),
    order_by: "-updated_at",
    per_page: CLOSED_ITEMS_LIMIT,
    cursor: `${CLOSED_ITEMS_LIMIT}:0:0`,
  });
  if (Array.isArray(closedResponse?.results)) items.push(...(closedResponse.results as TIssue[]));

  return { items, isOpenWorkTruncated, hasMoreClosedWork: Boolean(closedResponse?.next_page_results) };
};

/**
 * Work items for the board: of every project the user can see, or of one project when given.
 * Moves and assignee changes are applied optimistically and rolled back if the request fails.
 */
export const useGeneralBoard = (workspaceSlug: string | undefined, projectId?: string) => {
  // store hooks
  const { fetchWorkspaceStates, getStateById, getProjectStates } = useProjectState();
  const {
    workspace: { fetchWorkspaceMembers },
  } = useMember();
  // translation
  const { t } = useTranslation();
  // state
  const [items, setItems] = useState<TIssue[]>([]);

  const { data, isLoading, error, mutate } = useSWR(
    workspaceSlug ? `GENERAL_BOARD_ITEMS_${workspaceSlug}_${projectId ?? "all"}` : null,
    workspaceSlug ? () => fetchBoardItems(workspaceSlug, projectId) : null,
    { revalidateOnFocus: false }
  );
  useSWR(
    workspaceSlug ? `GENERAL_BOARD_STATES_${workspaceSlug}` : null,
    workspaceSlug ? () => fetchWorkspaceStates(workspaceSlug) : null,
    { revalidateOnFocus: false }
  );
  useSWR(
    workspaceSlug ? `GENERAL_BOARD_MEMBERS_${workspaceSlug}` : null,
    workspaceSlug ? () => fetchWorkspaceMembers(workspaceSlug) : null,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (data) setItems(data.items);
  }, [data]);

  /** The column an item belongs to: its state group, or "consultant" when its state is the marked one. */
  const getItemGroup = useCallback(
    (item: TIssue): TBoardColumn | undefined => {
      const state = getStateById(item.state_id);
      if (state?.external_id === CONSULTANT_STATE_MARK) return "consultant";
      const group = state?.group ?? item.state__group ?? undefined;
      return group && (GENERAL_BOARD_GROUPS as string[]).includes(group) ? (group as TBoardColumn) : undefined;
    },
    [getStateById]
  );

  const patchItem = useCallback(
    async (item: TIssue, payload: Partial<TIssue>, localOnly: Partial<TIssue> = {}) => {
      if (!workspaceSlug || !item.project_id) return;
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, ...payload, ...localOnly } : entry))
      );
      try {
        await issueService.patchIssue(workspaceSlug, item.project_id, item.id, payload);
      } catch {
        setItems((current) => current.map((entry) => (entry.id === item.id ? item : entry)));
        setToast({
          type: "error",
          title: t("general_board.update_failed.title"),
          message: t("general_board.update_failed.message"),
        });
      }
    },
    [t, workspaceSlug]
  );

  /** Moves the item to the state of the target column in the item's own project. */
  const moveItem = useCallback(
    async (item: TIssue, targetColumn: TBoardColumn) => {
      if (getItemGroup(item) === targetColumn) return;
      const projectStates = getProjectStates(item.project_id) ?? [];
      // "consultant" is one marked state; every other column takes the first state of its group,
      // leaving the marked one out of "started".
      const candidates =
        targetColumn === "consultant"
          ? projectStates.filter((state) => state.external_id === CONSULTANT_STATE_MARK)
          : projectStates.filter(
              (state) => state.group === targetColumn && state.external_id !== CONSULTANT_STATE_MARK
            );
      const targetState = sortBy(candidates, (state) => state.sequence)[0];
      if (!targetState) {
        setToast({
          type: "error",
          title: t("general_board.no_state.title"),
          message: t("general_board.no_state.message"),
        });
        return;
      }
      await patchItem(item, { state_id: targetState.id }, { state__group: targetState.group });
    },
    [getItemGroup, getProjectStates, patchItem, t]
  );

  const setAssignees = useCallback(
    async (item: TIssue, assigneeIds: string[]) => patchItem(item, { assignee_ids: assigneeIds }),
    [patchItem]
  );

  const reload = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    items,
    reload,
    isLoading,
    hasError: Boolean(error),
    isOpenWorkTruncated: data?.isOpenWorkTruncated ?? false,
    hasMoreClosedWork: data?.hasMoreClosedWork ?? false,
    getItemGroup,
    moveItem,
    setAssignees,
  };
};
