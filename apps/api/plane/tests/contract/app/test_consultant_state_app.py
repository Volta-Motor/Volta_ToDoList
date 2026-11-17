# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Imported pytest fixtures are requested by parameter name, which F811 misreads as redefinition.
# ruff: noqa: F811

"""Contract tests for the 'Danışmanda' (with the consultant) state.

Every project has it, between in progress and done, and the board finds it by
its mark rather than its name.
"""

from unittest.mock import patch

import pytest
from rest_framework import status

from plane.db.models import Project, State
from plane.tests.contract.app.test_guest_issue_subresource_scope_app import project  # noqa: F401
from plane.todolist.consultant_state import ensure_consultant_state


def _consultant_states(project):
    return State.objects.filter(project=project, external_source="todolist", external_id="consultant")


@pytest.mark.contract
@pytest.mark.django_db
class TestConsultantState:
    def test_new_project_gets_the_state(self, project):
        state = _consultant_states(project).get()

        assert state.name == "Danışmanda"
        assert state.group == "started"
        assert state.workspace_id == project.workspace_id

    def test_project_created_through_the_api_gets_it_between_in_progress_and_done(self, session_client, workspace):
        with patch("plane.app.views.project.base.model_activity.delay"):
            response = session_client.post(
                f"/api/workspaces/{workspace.slug}/projects/", {"name": "Yeni", "identifier": "YENI"}, format="json"
            )
        assert response.status_code == status.HTTP_201_CREATED

        names = list(
            State.objects.filter(project_id=response.data["id"], is_triage=False)
            .order_by("sequence")
            .values_list("name", flat=True)
        )
        assert names == ["Backlog", "Todo", "In Progress", "Danışmanda", "Done", "Cancelled"]

    def test_running_again_does_not_duplicate(self, project):
        ensure_consultant_state(project)
        ensure_consultant_state(project)
        assert _consultant_states(project).count() == 1

    def test_state_with_the_same_name_is_marked_not_duplicated(self, workspace, create_user):
        other = Project.objects.create(name="Başka", identifier="BSK", workspace=workspace, created_by=create_user)
        _consultant_states(other).delete()
        own = State.objects.create(
            project=other, workspace=workspace, name="danışmanda", color="#111111", group="started"
        )

        ensure_consultant_state(other)

        assert list(_consultant_states(other)) == [own]

    def test_renamed_state_is_still_found(self, project):
        state = _consultant_states(project).get()
        state.name = "Dış danışmanda"
        state.save()

        ensure_consultant_state(project)

        assert _consultant_states(project).count() == 1
        assert not State.objects.filter(project=project, name="Danışmanda").exists()

    def test_states_api_exposes_the_mark(self, session_client, workspace, project):
        response = session_client.get(f"/api/workspaces/{workspace.slug}/states/")

        assert response.status_code == status.HTTP_200_OK
        marks = {item["name"]: item["external_id"] for item in response.data}
        assert marks == {"Danışmanda": "consultant"}

    def test_mark_cannot_be_set_through_the_api(self, session_client, workspace, project):
        url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/states/"
        response = session_client.post(
            url, {"name": "Sahte", "color": "#222222", "group": "started", "external_id": "consultant"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert _consultant_states(project).count() == 1
