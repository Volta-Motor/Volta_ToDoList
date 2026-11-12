/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import useSWR from "swr";
// plane imports
import type { TIssue } from "@plane/types";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";

/**
 * Story points of work items across projects. Every project has its own estimate, so the point a
 * work item carries is looked up in the active estimate of the work item's project.
 *
 * The values live in a MobX store: call `getStoryPoints` from an `observer` component.
 */
export const useStoryPoints = (workspaceSlug: string | undefined) => {
  const { getWorkspaceEstimates, currentActiveEstimateIdByProjectId, estimateById } = useProjectEstimates();

  useSWR(
    workspaceSlug ? `STORY_POINT_ESTIMATES_${workspaceSlug}` : null,
    workspaceSlug ? () => getWorkspaceEstimates(workspaceSlug) : null,
    { revalidateOnFocus: false }
  );

  /** The story points of a work item, or `undefined` when it has none (or its value is not a number). */
  const getStoryPoints = useCallback(
    (item: Pick<TIssue, "project_id" | "estimate_point">): number | undefined => {
      if (!item.project_id || !item.estimate_point) return undefined;
      const estimateId = currentActiveEstimateIdByProjectId(item.project_id);
      if (!estimateId) return undefined;
      const value = estimateById(estimateId)?.estimatePointById(item.estimate_point)?.value;
      const points = value === undefined || value === null || value === "" ? Number.NaN : Number(value);
      return Number.isFinite(points) ? points : undefined;
    },
    [currentActiveEstimateIdByProjectId, estimateById]
  );

  /** Sum of the story points of the given work items; items without points count as zero. */
  const sumStoryPoints = useCallback(
    (items: Pick<TIssue, "project_id" | "estimate_point">[]): number =>
      items.reduce((total, item) => total + (getStoryPoints(item) ?? 0), 0),
    [getStoryPoints]
  );

  return { getStoryPoints, sumStoryPoints };
};
