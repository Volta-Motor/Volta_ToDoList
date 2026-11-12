# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Imported pytest fixtures are requested by parameter name, which F811 misreads as redefinition.
# ruff: noqa: F811

"""Contract tests for work item types.

Every workspace gets the same four types on first use. A new work item takes
the default type, and a work item only accepts a type of its own workspace.
"""

from unittest.mock import patch

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import Issue, IssueType, User, Workspace
from plane.tests.contract.app.test_guest_issue_subresource_scope_app import project  # noqa: F401

TYPES_URL = "/api/workspaces/{slug}/work-item-types/"
ISSUES_URL = "/api/workspaces/{slug}/projects/{project_id}/issues/"


@pytest.fixture(autouse=True)
def _no_background_tasks():
    with (
        patch("plane.app.views.issue.base.issue_activity.delay"),
        patch("plane.app.views.issue.base.model_activity.delay"),
        patch("plane.app.views.issue.base.issue_description_version_task.delay"),
        patch("plane.app.views.issue.base.recent_visited_task.delay"),
    ):
        yield


def _types(client, workspace):
    response = client.get(TYPES_URL.format(slug=workspace.slug))
    assert response.status_code == status.HTTP_200_OK
    return response.data


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkItemTypes:
    def test_defaults_are_created_once(self, session_client, workspace):
        first = _types(session_client, workspace)
        second = _types(session_client, workspace)

        assert [item["key"] for item in first] == ["task", "bug", "story", "feature"]
        assert [item["name"] for item in first] == ["Görev", "Hata", "Kullanıcı hikâyesi", "Özellik"]
        assert [item["is_default"] for item in first] == [True, False, False, False]
        assert [item["id"] for item in first] == [item["id"] for item in second]
        assert IssueType.objects.filter(workspace=workspace).count() == 4

    def test_non_member_is_blocked(self, db, workspace):
        outsider = User.objects.create(email="outsider@plane.so", username="outsider_user")
        client = APIClient()
        client.force_authenticate(user=outsider)

        response = client.get(TYPES_URL.format(slug=workspace.slug))
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert not IssueType.objects.filter(workspace=workspace).exists()

    def test_new_work_item_takes_default_type(self, session_client, workspace, project):
        url = ISSUES_URL.format(slug=workspace.slug, project_id=project.id)
        response = session_client.post(url, {"name": "Türsüz açılan iş"}, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        issue = Issue.objects.get(pk=response.data["id"])
        assert issue.type.name == "Görev"
        assert str(response.data["type_id"]) == str(issue.type_id)

    def test_type_is_set_and_returned(self, session_client, workspace, project):
        bug = next(item for item in _types(session_client, workspace) if item["key"] == "bug")
        issue = Issue.objects.create(name="Kur farkı", project=project, workspace=workspace)
        base = ISSUES_URL.format(slug=workspace.slug, project_id=project.id)

        response = session_client.patch(f"{base}{issue.id}/", {"type_id": bug["id"]}, format="json")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        issue.refresh_from_db()
        assert str(issue.type_id) == str(bug["id"])

        detail = session_client.get(f"{base}{issue.id}/")
        assert str(detail.data["type_id"]) == str(bug["id"])

        listed = session_client.get(f"/api/workspaces/{workspace.slug}/issues/")
        assert listed.status_code == status.HTTP_200_OK
        assert [str(item["type_id"]) for item in listed.data["results"]] == [str(bug["id"])]

    @pytest.mark.parametrize("field", ["type_id", "type"])
    def test_type_of_another_workspace_is_rejected(self, session_client, create_user, workspace, project, field):
        other_workspace = Workspace.objects.create(name="Other", owner=create_user, slug="other-workspace")
        foreign_type = IssueType.objects.create(workspace=other_workspace, name="Foreign")
        issue = Issue.objects.create(name="Kur farkı", project=project, workspace=workspace)
        base = ISSUES_URL.format(slug=workspace.slug, project_id=project.id)

        response = session_client.patch(f"{base}{issue.id}/", {field: str(foreign_type.id)}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        issue.refresh_from_db()
        assert issue.type_id is None
