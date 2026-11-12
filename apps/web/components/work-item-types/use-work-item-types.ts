/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import useSWR from "swr";
// services
import { TodoListService } from "@/services/todolist.service";
import type { TWorkItemType } from "@/services/todolist.service";

const todoListService = new TodoListService();

/** The workspace's work item types. They rarely change, so they are fetched once and shared. */
export const useWorkItemTypes = (workspaceSlug: string | undefined) => {
  const { data, error } = useSWR(
    workspaceSlug ? `WORK_ITEM_TYPES_${workspaceSlug}` : null,
    workspaceSlug ? () => todoListService.listWorkItemTypes(workspaceSlug) : null,
    { revalidateOnFocus: false, revalidateIfStale: false }
  );

  const getTypeById = useCallback(
    (typeId: string | null | undefined): TWorkItemType | undefined =>
      typeId ? data?.find((type) => type.id === typeId) : undefined,
    [data]
  );

  return { types: data ?? [], getTypeById, hasError: Boolean(error) };
};
