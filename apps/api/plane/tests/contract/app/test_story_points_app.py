# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Imported pytest fixtures are requested by parameter name, which F811 misreads as redefinition.
# ruff: noqa: F811

"""Contract tests for story points.

Every project gets a Fibonacci story point estimate when it is created, so a
work item can be given points without any project setup.
"""

from unittest.mock import patch

import pytest
from rest_framework import status

from plane.db.models import Estimate, EstimatePoint, Issue, Project
from plane.tests.contract.app.test_guest_issue_subresource_scope_app import project  # noqa: F401
from plane.todolist.story_points import FIBONACCI_POINTS, ensure_story_point_estimate

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


def _point_values(estimate):
    return list(EstimatePoint.objects.filter(estimate=estimate).order_by("key").values_list("value", flat=True))


@pytest.mark.contract
@pytest.mark.django_db
class TestStoryPoints:
    def test_new_project_gets_fibonacci_estimate(self, project):
        project.refresh_from_db()

        assert project.estimate is not None
        assert project.estimate.type == "points"
        assert project.estimate.last_used is True
        assert _point_values(project.estimate) == FIBONACCI_POINTS == ["1", "2", "3", "5", "8", "13", "21"]

    def test_points_belong_to_the_project_and_workspace(self, workspace, project):
        points = EstimatePoint.objects.filter(estimate=project.estimate)
        assert {point.project_id for point in points} == {project.id}
        assert {point.workspace_id for point in points} == {workspace.id}

    def test_existing_estimate_is_kept(self, workspace, create_user):
        other = Project.objects.create(
            name="Kendi sistemi", identifier="KS", workspace=workspace, created_by=create_user
        )
        own = Estimate.objects.create(project=other, name="Tişört", type="categories", last_used=True)
        Project.objects.filter(pk=other.pk).update(estimate=own)
        other.refresh_from_db()

        ensure_story_point_estimate(other)

        other.refresh_from_db()
        assert other.estimate_id == own.id

    def test_running_twice_does_not_duplicate(self, project):
        Project.objects.filter(pk=project.pk).update(estimate=None)
        project.refresh_from_db()

        ensure_story_point_estimate(project)
        ensure_story_point_estimate(project)

        assert Estimate.objects.filter(project=project).count() == 1
        project.refresh_from_db()
        assert _point_values(project.estimate) == FIBONACCI_POINTS

    def test_work_item_takes_a_story_point(self, session_client, workspace, project):
        project.refresh_from_db()
        five = EstimatePoint.objects.get(estimate=project.estimate, value="5")
        issue = Issue.objects.create(name="Kur farkı", project=project, workspace=workspace)
        url = f"{ISSUES_URL.format(slug=workspace.slug, project_id=project.id)}{issue.id}/"

        response = session_client.patch(url, {"estimate_point": str(five.id)}, format="json")
        assert response.status_code == status.HTTP_204_NO_CONTENT

        detail = session_client.get(url)
        assert str(detail.data["estimate_point"]) == str(five.id)

    def test_point_of_another_project_is_rejected(self, session_client, workspace, project, create_user):
        other = Project.objects.create(name="Başka", identifier="BSK", workspace=workspace, created_by=create_user)
        other.refresh_from_db()
        foreign_point = EstimatePoint.objects.filter(estimate=other.estimate).first()
        issue = Issue.objects.create(name="Kur farkı", project=project, workspace=workspace)
        url = f"{ISSUES_URL.format(slug=workspace.slug, project_id=project.id)}{issue.id}/"

        response = session_client.patch(url, {"estimate_point": str(foreign_point.id)}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        issue.refresh_from_db()
        assert issue.estimate_point_id is None
