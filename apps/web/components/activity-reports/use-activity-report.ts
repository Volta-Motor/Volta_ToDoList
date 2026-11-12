/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
// plane imports
import type { TIssue } from "@plane/types";
// hooks
import { useMember } from "@/hooks/store/use-member";
// services
import { WorkspaceService } from "@/services/workspace.service";

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

const workspaceService = new WorkspaceService();

export type TReportMonth = {
  /** `YYYY-MM`, also used as the option value. */
  key: string;
  year: number;
  /** Zero based, as in `Date`. */
  month: number;
};

const pad = (value: number) => String(value).padStart(2, "0");

/** The current month followed by the eleven before it. */
export const getReportMonths = (today: Date = new Date()): TReportMonth[] =>
  Array.from({ length: 12 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    return {
      key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}`,
      year: date.getFullYear(),
      month: date.getMonth(),
    };
  });

export const getMonthRange = (reportMonth: TReportMonth) => {
  const lastDay = new Date(reportMonth.year, reportMonth.month + 1, 0).getDate();
  const prefix = `${reportMonth.year}-${pad(reportMonth.month + 1)}`;
  return { start: `${prefix}-01`, end: `${prefix}-${pad(lastDay)}` };
};

type TReportData = {
  completed: TIssue[];
  inProgress: TIssue[];
  isTruncated: boolean;
};

const fetchAllPages = async (workspaceSlug: string, params: Record<string, string>) => {
  const items: TIssue[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    // Pages are read one after another on purpose: each response says whether another page exists.
    // oxlint-disable-next-line no-await-in-loop
    const response = await workspaceService.getViewIssues(workspaceSlug, {
      ...params,
      per_page: PAGE_SIZE,
      cursor: `${PAGE_SIZE}:${page}:0`,
    });
    if (Array.isArray(response?.results)) items.push(...(response.results as TIssue[]));
    if (!response?.next_page_results) return { items, isTruncated: false };
  }
  return { items, isTruncated: true };
};

const fetchReport = async (
  workspaceSlug: string,
  reportMonth: TReportMonth,
  includeInProgress: boolean
): Promise<TReportData> => {
  const { start, end } = getMonthRange(reportMonth);
  const completed = await fetchAllPages(workspaceSlug, {
    state_group: "completed",
    completed_at: `${start};after,${end};before`,
    order_by: "completed_at",
  });
  const inProgress = includeInProgress
    ? await fetchAllPages(workspaceSlug, { state_group: "started", order_by: "target_date" })
    : { items: [], isTruncated: false };

  return {
    completed: completed.items,
    inProgress: inProgress.items,
    isTruncated: completed.isTruncated || inProgress.isTruncated,
  };
};

/**
 * Work completed in one calendar month, across every project the user can see.
 * Work in progress is only loaded for the current month: what was in progress in a past month is not recorded.
 */
export const useActivityReport = (
  workspaceSlug: string | undefined,
  reportMonth: TReportMonth,
  isCurrentMonth: boolean
) => {
  const {
    workspace: { fetchWorkspaceMembers },
  } = useMember();

  const { data, isLoading, error } = useSWR(
    workspaceSlug ? `ACTIVITY_REPORT_${workspaceSlug}_${reportMonth.key}_${isCurrentMonth}` : null,
    workspaceSlug ? () => fetchReport(workspaceSlug, reportMonth, isCurrentMonth) : null,
    { revalidateOnFocus: false }
  );
  useSWR(
    workspaceSlug ? `ACTIVITY_REPORT_MEMBERS_${workspaceSlug}` : null,
    workspaceSlug ? () => fetchWorkspaceMembers(workspaceSlug) : null,
    { revalidateOnFocus: false }
  );

  return {
    completed: data?.completed ?? [],
    inProgress: data?.inProgress ?? [],
    isTruncated: data?.isTruncated ?? false,
    isLoading,
    hasError: Boolean(error),
  };
};
