/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo } from "react";
import useSWR from "swr";
// plane imports
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
// services
import { TodoListService } from "@/services/todolist.service";
import type { TAcceptanceCriterion, TCriterionKind } from "@/services/todolist.service";

const todoListService = new TodoListService();

/**
 * One of the two criteria lists (acceptance or test) of a work item. Changes show at once and are rolled back with a
 * message when the server refuses them.
 */
export const useAcceptanceCriteria = (
  workspaceSlug: string,
  projectId: string,
  issueId: string,
  kind: TCriterionKind
) => {
  const { t } = useTranslation();
  const { data, error, mutate } = useSWR(
    `ACCEPTANCE_CRITERIA_${workspaceSlug}_${projectId}_${issueId}`,
    () => todoListService.listAcceptanceCriteria(workspaceSlug, projectId, issueId),
    { revalidateOnFocus: false }
  );

  const showSaveError = useCallback(() => setToast({ type: "error", title: t("acceptance_criteria.save_error") }), [t]);

  const addCriterion = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        const created = await todoListService.createAcceptanceCriterion(workspaceSlug, projectId, issueId, {
          text,
          kind,
        });
        await mutate((current) => [...(current ?? []), created], { revalidate: false });
        return true;
      } catch {
        showSaveError();
        return false;
      }
    },
    [workspaceSlug, projectId, issueId, kind, mutate, showSaveError]
  );

  const updateCriterion = useCallback(
    async (criterionId: string, changes: Partial<Pick<TAcceptanceCriterion, "text" | "is_done">>) => {
      const applyChanges = (current: TAcceptanceCriterion[] | undefined) =>
        // The list is SWR's cached data, so the changed item is copied rather than mutated in place.
        // oxlint-disable-next-line no-map-spread
        (current ?? []).map((item) => (item.id === criterionId ? { ...item, ...changes } : item));
      try {
        await mutate(
          async (current) => {
            await todoListService.updateAcceptanceCriterion(workspaceSlug, projectId, issueId, criterionId, changes);
            return applyChanges(current);
          },
          { optimisticData: applyChanges, rollbackOnError: true, revalidate: false }
        );
      } catch {
        showSaveError();
      }
    },
    [workspaceSlug, projectId, issueId, mutate, showSaveError]
  );

  const removeCriterion = useCallback(
    async (criterionId: string) => {
      const withoutCriterion = (current: TAcceptanceCriterion[] | undefined) =>
        (current ?? []).filter((item) => item.id !== criterionId);
      try {
        await mutate(
          async (current) => {
            await todoListService.deleteAcceptanceCriterion(workspaceSlug, projectId, issueId, criterionId);
            return withoutCriterion(current);
          },
          { optimisticData: withoutCriterion, rollbackOnError: true, revalidate: false }
        );
      } catch {
        showSaveError();
      }
    },
    [workspaceSlug, projectId, issueId, mutate, showSaveError]
  );

  // Both lists of the work item come in one response; this hook hands out the one asked for.
  const criteria = useMemo(() => (data ?? []).filter((item) => item.kind === kind), [data, kind]);

  return {
    criteria,
    isLoading: !data && !error,
    hasError: Boolean(error),
    addCriterion,
    updateCriterion,
    removeCriterion,
  };
};
