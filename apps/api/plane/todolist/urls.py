# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from .views import IssueAcceptanceCriterionViewSet, WorkItemTypesEndpoint

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/acceptance-criteria/",
        IssueAcceptanceCriterionViewSet.as_view({"get": "list", "post": "create"}),
        name="issue-acceptance-criteria",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/acceptance-criteria/<uuid:pk>/",
        IssueAcceptanceCriterionViewSet.as_view({"patch": "partial_update", "delete": "destroy"}),
        name="issue-acceptance-criteria",
    ),
    path(
        "workspaces/<str:slug>/work-item-types/",
        WorkItemTypesEndpoint.as_view(),
        name="work-item-types",
    ),
]
