# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for automatic project membership.

Admins and members of a workspace are members of all its projects. This is
made true when someone asks for the project list, which the app does on every
load. Guests and people removed from a project by hand are left alone.
"""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import Project, ProjectMember, ProjectUserProperty, User, WorkspaceMember

LIST_URL = "/api/workspaces/{slug}/projects/"
DETAILS_URL = "/api/workspaces/{slug}/projects/details/"


def _project(workspace, name, identifier, **extra):
    """A project that is old enough to be past the grace period for new projects."""
    project = Project.objects.create(name=name, identifier=identifier, workspace=workspace, **extra)
    Project.objects.filter(pk=project.pk).update(created_at=timezone.now() - timedelta(minutes=5))
    return project


def _member(workspace, name, role, **extra):
    user = User.objects.create(email=f"{name}@example.com", username=name, **extra)
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _role(project, user):
    membership = ProjectMember.objects.filter(project=project, member=user, is_active=True).first()
    return membership.role if membership else None


@pytest.mark.contract
@pytest.mark.django_db
class TestAutomaticProjectMembership:
    @pytest.mark.parametrize("url", [LIST_URL, DETAILS_URL])
    def test_member_joins_every_project_on_listing(self, workspace, url):
        first = _project(workspace, "Birinci", "BIR")
        second = _project(workspace, "İkinci", "IKI")
        ada = _member(workspace, "ada", role=15)

        response = _client(ada).get(url.format(slug=workspace.slug))

        assert response.status_code == status.HTTP_200_OK
        assert (_role(first, ada), _role(second, ada)) == (15, 15)
        # the per-project view settings Plane keeps for a member
        assert ProjectUserProperty.objects.filter(user=ada).count() == 2
        # and the answer already shows them as a member
        assert {str(item["id"]) for item in response.data if item.get("member_role")} == {
            str(first.id),
            str(second.id),
        }

    def test_workspace_admin_becomes_project_admin(self, workspace):
        project = _project(workspace, "Birinci", "BIR")
        grace = _member(workspace, "grace", role=20)

        _client(grace).get(LIST_URL.format(slug=workspace.slug))

        assert _role(project, grace) == 20

    def test_listing_again_changes_nothing(self, workspace):
        project = _project(workspace, "Birinci", "BIR")
        ada = _member(workspace, "ada", role=15)
        client = _client(ada)

        client.get(LIST_URL.format(slug=workspace.slug))
        client.get(LIST_URL.format(slug=workspace.slug))

        assert ProjectMember.objects.filter(project=project, member=ada).count() == 1

    def test_guest_is_not_added(self, workspace):
        project = _project(workspace, "Birinci", "BIR")
        guest = _member(workspace, "guest", role=5)

        _client(guest).get(LIST_URL.format(slug=workspace.slug))

        assert _role(project, guest) is None

    def test_someone_outside_the_workspace_is_not_added(self, workspace):
        project = _project(workspace, "Birinci", "BIR")
        outsider = User.objects.create(email="outsider@example.com", username="outsider")

        response = _client(outsider).get(LIST_URL.format(slug=workspace.slug))

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert not ProjectMember.objects.filter(project=project).exists()

    def test_projects_of_another_workspace_are_untouched(self, workspace, create_user):
        from plane.db.models import Workspace

        other_workspace = Workspace.objects.create(name="Other", owner=create_user, slug="other-workspace")
        foreign = _project(other_workspace, "Yabancı", "YAB")
        ada = _member(workspace, "ada", role=15)

        _client(ada).get(LIST_URL.format(slug=workspace.slug))

        assert _role(foreign, ada) is None

    def test_someone_removed_from_a_project_stays_removed(self, workspace):
        project = _project(workspace, "Birinci", "BIR")
        ada = _member(workspace, "ada", role=15)
        ProjectMember.objects.create(project=project, member=ada, workspace=workspace, role=15, is_active=False)

        _client(ada).get(LIST_URL.format(slug=workspace.slug))

        assert _role(project, ada) is None
        assert ProjectMember.objects.filter(project=project, member=ada).count() == 1

    def test_archived_project_is_skipped(self, workspace):
        project = _project(workspace, "Arşiv", "ARS")
        Project.objects.filter(pk=project.pk).update(archived_at=timezone.now())
        ada = _member(workspace, "ada", role=15)

        _client(ada).get(LIST_URL.format(slug=workspace.slug))

        assert _role(project, ada) is None

    def test_project_created_a_moment_ago_waits_for_the_next_listing(self, workspace):
        # Plane adds the creator and the lead right after it saves a new project; stepping in
        # before that would write the same membership twice.
        project = Project.objects.create(name="Yeni", identifier="YENI", workspace=workspace)
        ada = _member(workspace, "ada", role=15)
        client = _client(ada)

        client.get(LIST_URL.format(slug=workspace.slug))
        assert _role(project, ada) is None

        Project.objects.filter(pk=project.pk).update(created_at=timezone.now() - timedelta(minutes=1))
        client.get(LIST_URL.format(slug=workspace.slug))
        assert _role(project, ada) == 15

    def test_can_be_turned_off(self, workspace, monkeypatch):
        monkeypatch.setenv("TODOLIST_AUTO_PROJECT_MEMBERSHIP", "0")
        project = _project(workspace, "Birinci", "BIR")
        ada = _member(workspace, "ada", role=15)

        _client(ada).get(LIST_URL.format(slug=workspace.slug))

        assert _role(project, ada) is None
