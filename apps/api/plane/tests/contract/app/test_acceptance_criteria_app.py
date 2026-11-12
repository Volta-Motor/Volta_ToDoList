# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Imported pytest fixtures are requested by parameter name, which F811 misreads as redefinition.
# ruff: noqa: F811

"""Contract tests for the acceptance criteria checklist of a work item.

Project members read the list, admins and members change it, and a restricted
guest only reaches the criteria of work items they created.
"""

from unittest.mock import patch

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import Issue, Project, ProjectMember, User, WorkspaceMember
from plane.tests.contract.app.test_guest_issue_subresource_scope_app import (  # noqa: F401
    foreign_issue,
    guest,
    guest_client,
    own_issue,
    project,
)
from plane.todolist.models import IssueAcceptanceCriterion

LIST_URL = "/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/acceptance-criteria/"


def _url(workspace, project, issue, pk=None):
    url = LIST_URL.format(slug=workspace.slug, project_id=project.id, issue_id=issue.id)
    return f"{url}{pk}/" if pk else url


@pytest.fixture(autouse=True)
def _no_background_tasks():
    with patch("plane.db.mixins.soft_delete_related_objects"):
        yield


@pytest.fixture
def criterion(workspace, project, foreign_issue):
    return IssueAcceptanceCriterion.objects.create(
        issue=foreign_issue, project=project, workspace=workspace, text="Rapor PDF olarak indirilebilir"
    )


@pytest.mark.contract
@pytest.mark.django_db
class TestAcceptanceCriteria:
    def test_member_creates_and_lists_in_order(self, session_client, workspace, project, foreign_issue):
        url = _url(workspace, project, foreign_issue)
        first = session_client.post(url, {"text": "  İlk kriter  "}, format="json")
        second = session_client.post(url, {"text": "İkinci kriter"}, format="json")

        assert first.status_code == status.HTTP_201_CREATED
        assert second.status_code == status.HTTP_201_CREATED
        assert first.data["text"] == "İlk kriter"
        assert first.data["is_done"] is False
        assert second.data["sort_order"] > first.data["sort_order"]

        listed = session_client.get(url)
        assert listed.status_code == status.HTTP_200_OK
        assert [item["text"] for item in listed.data] == ["İlk kriter", "İkinci kriter"]

    def test_test_criteria_are_a_separate_list(self, session_client, workspace, project, foreign_issue):
        url = _url(workspace, project, foreign_issue)
        session_client.post(url, {"text": "Kabul 1"}, format="json")
        first_test = session_client.post(url, {"text": "Test 1", "kind": "test"}, format="json")
        session_client.post(url, {"text": "Kabul 2"}, format="json")
        second_test = session_client.post(url, {"text": "Test 2", "kind": "test"}, format="json")

        assert first_test.status_code == status.HTTP_201_CREATED
        assert first_test.data["kind"] == "test"
        # Each list is ordered on its own.
        assert second_test.data["sort_order"] > first_test.data["sort_order"]

        listed = session_client.get(url).data
        assert [item["text"] for item in listed if item["kind"] == "acceptance"] == ["Kabul 1", "Kabul 2"]
        assert [item["text"] for item in listed if item["kind"] == "test"] == ["Test 1", "Test 2"]

    def test_unknown_kind_is_rejected(self, session_client, workspace, project, foreign_issue):
        response = session_client.post(
            _url(workspace, project, foreign_issue), {"text": "x", "kind": "other"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_kind_cannot_be_changed(self, session_client, workspace, project, foreign_issue, criterion):
        detail = _url(workspace, project, foreign_issue, criterion.id)
        session_client.patch(detail, {"kind": "test", "is_done": True}, format="json")
        criterion.refresh_from_db()
        assert criterion.kind == "acceptance"
        assert criterion.is_done is True

    def test_empty_text_is_rejected(self, session_client, workspace, project, foreign_issue):
        response = session_client.post(_url(workspace, project, foreign_issue), {"text": "   "}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not IssueAcceptanceCriterion.objects.exists()

    def test_member_updates_and_deletes(self, session_client, workspace, project, foreign_issue, criterion):
        detail = _url(workspace, project, foreign_issue, criterion.id)

        response = session_client.patch(detail, {"is_done": True, "text": "Güncel metin"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        criterion.refresh_from_db()
        assert criterion.is_done is True
        assert criterion.text == "Güncel metin"

        assert session_client.delete(detail).status_code == status.HTTP_204_NO_CONTENT
        assert not IssueAcceptanceCriterion.objects.filter(pk=criterion.pk).exists()

    def test_issue_cannot_be_reassigned(self, session_client, workspace, project, foreign_issue, own_issue, criterion):
        detail = _url(workspace, project, foreign_issue, criterion.id)
        session_client.patch(detail, {"issue": str(own_issue.id)}, format="json")
        criterion.refresh_from_db()
        assert criterion.issue_id == foreign_issue.id

    def test_criterion_is_scoped_to_its_issue(self, session_client, workspace, project, own_issue, criterion):
        # `criterion` belongs to `foreign_issue`; it is not reachable through another work item's URL.
        detail = _url(workspace, project, own_issue, criterion.id)
        assert session_client.patch(detail, {"is_done": True}, format="json").status_code == status.HTTP_404_NOT_FOUND
        assert session_client.delete(detail).status_code == status.HTTP_404_NOT_FOUND
        criterion.refresh_from_db()
        assert criterion.is_done is False

    def test_issue_of_another_project_is_rejected(self, session_client, create_user, workspace, project, criterion):
        other = Project.objects.create(name="Other", identifier="OTH", workspace=workspace, created_by=create_user)
        ProjectMember.objects.create(project=other, member=create_user, workspace=workspace, role=20)
        other_issue = Issue.objects.create(name="Elsewhere", project=other, workspace=workspace)

        response = session_client.post(_url(workspace, project, other_issue), {"text": "x"}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert IssueAcceptanceCriterion.objects.count() == 1

    def test_restricted_guest_blocked_on_foreign_issue(
        self, guest_client, workspace, project, foreign_issue, criterion
    ):
        url = _url(workspace, project, foreign_issue)
        detail = _url(workspace, project, foreign_issue, criterion.id)
        responses = [
            guest_client.get(url),
            guest_client.post(url, {"text": "x"}, format="json"),
            guest_client.patch(detail, {"is_done": True}, format="json"),
            guest_client.delete(detail),
        ]
        assert [r.status_code for r in responses] == [status.HTTP_403_FORBIDDEN] * 4
        criterion.refresh_from_db()
        assert criterion.is_done is False

    def test_guest_reads_but_cannot_change_own_issue(self, guest_client, workspace, project, own_issue):
        url = _url(workspace, project, own_issue)
        assert guest_client.get(url).status_code == status.HTTP_200_OK
        assert guest_client.post(url, {"text": "x"}, format="json").status_code == status.HTTP_403_FORBIDDEN

    def test_non_member_is_blocked(self, db, workspace, project, foreign_issue, criterion):
        outsider = User.objects.create(email="outsider@plane.so", username="outsider_user")
        outsider.set_password("test-password")
        outsider.save()
        WorkspaceMember.objects.create(workspace=workspace, member=outsider, role=15)
        client = APIClient()
        client.force_authenticate(user=outsider)

        assert client.get(_url(workspace, project, foreign_issue)).status_code == status.HTTP_403_FORBIDDEN
        detail = _url(workspace, project, foreign_issue, criterion.id)
        assert client.delete(detail).status_code == status.HTTP_403_FORBIDDEN
        assert IssueAcceptanceCriterion.objects.filter(pk=criterion.pk).exists()
