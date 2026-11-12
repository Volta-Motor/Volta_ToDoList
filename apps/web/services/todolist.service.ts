/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { API_BASE_URL } from "@plane/constants";
// services
import { APIService } from "@/services/api.service";

/** A work item type of the workspace. `key` picks the color; `name` is shown as stored. */
export type TWorkItemType = {
  id: string;
  name: string;
  key: string | null;
  is_default: boolean;
  level: number;
};

export type TAcceptanceCriterion = {
  id: string;
  issue: string;
  text: string;
  is_done: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** Endpoints TO DO List adds on top of Plane's API. */
export class TodoListService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private criteriaUrl(workspaceSlug: string, projectId: string, issueId: string) {
    return `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/acceptance-criteria/`;
  }

  async listWorkItemTypes(workspaceSlug: string): Promise<TWorkItemType[]> {
    const response = await this.get(`/api/workspaces/${workspaceSlug}/work-item-types/`);
    return response?.data ?? [];
  }

  async listAcceptanceCriteria(
    workspaceSlug: string,
    projectId: string,
    issueId: string
  ): Promise<TAcceptanceCriterion[]> {
    const response = await this.get(this.criteriaUrl(workspaceSlug, projectId, issueId));
    return response?.data ?? [];
  }

  async createAcceptanceCriterion(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: Pick<TAcceptanceCriterion, "text">
  ): Promise<TAcceptanceCriterion> {
    const response = await this.post(this.criteriaUrl(workspaceSlug, projectId, issueId), data);
    return response?.data;
  }

  async updateAcceptanceCriterion(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    criterionId: string,
    data: Partial<Pick<TAcceptanceCriterion, "text" | "is_done" | "sort_order">>
  ): Promise<TAcceptanceCriterion> {
    const response = await this.patch(`${this.criteriaUrl(workspaceSlug, projectId, issueId)}${criterionId}/`, data);
    return response?.data;
  }

  async deleteAcceptanceCriterion(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    criterionId: string
  ): Promise<void> {
    await this.delete(`${this.criteriaUrl(workspaceSlug, projectId, issueId)}${criterionId}/`);
  }
}
