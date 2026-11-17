# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for a workspace admin resetting a member's password.

The server makes up a temporary password and hands it to the admin once. Only
an admin of the member's own workspace may do this.
"""

import pytest
from django.test import Client
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.authentication.utils.password import is_password_strong
from plane.db.models import User, Workspace, WorkspaceMember
from plane.license.models import Instance, InstanceAdmin
from plane.todolist.password_reset import generate_temporary_password

URL = "/api/workspaces/{slug}/users/{user_id}/reset-password/"
OLD_PASSWORD = "the-old-password-9431"


def _member(workspace, name, role=15, **extra):
    user = User.objects.create(email=f"{name}@example.com", username=name, **extra)
    user.set_password(OLD_PASSWORD)
    user.save()
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _reset(client, workspace, user):
    return client.post(URL.format(slug=workspace.slug, user_id=user.id))


@pytest.mark.contract
@pytest.mark.django_db
class TestMemberPasswordReset:
    def test_admin_gets_a_temporary_password_that_works(self, session_client, workspace):
        ada = _member(workspace, "ada")

        response = _reset(session_client, workspace, ada)

        assert response.status_code == status.HTTP_200_OK
        password = response.data["password"]
        ada.refresh_from_db()
        assert ada.check_password(password)
        assert not ada.check_password(OLD_PASSWORD)
        assert ada.is_password_autoset is False

    def test_each_reset_gives_a_different_strong_password(self, session_client, workspace):
        ada = _member(workspace, "ada")

        first = _reset(session_client, workspace, ada).data["password"]
        second = _reset(session_client, workspace, ada).data["password"]

        assert first != second
        assert is_password_strong(first) and is_password_strong(second)

    def test_generated_password_is_strong(self):
        passwords = {generate_temporary_password() for _ in range(50)}
        assert len(passwords) == 50
        assert all(is_password_strong(password) for password in passwords)

    def test_the_member_is_signed_out_everywhere(self, session_client, workspace):
        ada = _member(workspace, "ada")
        browser = Client()
        browser.force_login(ada)
        assert browser.get("/api/users/me/").status_code == status.HTTP_200_OK

        _reset(session_client, workspace, ada)

        assert browser.get("/api/users/me/").status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    @pytest.mark.parametrize("role", [15, 5])
    def test_only_a_workspace_admin_may_reset(self, workspace, role):
        ada = _member(workspace, "ada")
        requester = _member(workspace, "requester", role=role)

        response = _reset(_client(requester), workspace, ada)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        ada.refresh_from_db()
        assert ada.check_password(OLD_PASSWORD)

    def test_admin_of_another_workspace_may_not_reset(self, workspace, create_user):
        ada = _member(workspace, "ada")
        other_workspace = Workspace.objects.create(name="Other", owner=create_user, slug="other-workspace")
        outsider = _member(other_workspace, "outsider", role=20)

        # through the member's workspace: the outsider is not an admin there
        assert _reset(_client(outsider), workspace, ada).status_code == status.HTTP_403_FORBIDDEN
        # through the outsider's own workspace: the member is not in it
        assert _reset(_client(outsider), other_workspace, ada).status_code == status.HTTP_404_NOT_FOUND
        ada.refresh_from_db()
        assert ada.check_password(OLD_PASSWORD)

    def test_own_password_is_not_reset_this_way(self, session_client, workspace, create_user):
        response = _reset(session_client, workspace, create_user)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_removed_member_and_bot_are_not_found(self, session_client, workspace):
        gone = _member(workspace, "gone")
        WorkspaceMember.objects.filter(member=gone).update(is_active=False)
        bot = _member(workspace, "bot", is_bot=True)

        assert _reset(session_client, workspace, gone).status_code == status.HTTP_404_NOT_FOUND
        assert _reset(session_client, workspace, bot).status_code == status.HTTP_404_NOT_FOUND

    def test_instance_admin_is_protected_from_workspace_admins(self, workspace, create_user):
        instance = Instance.objects.create(
            instance_name="Test",
            instance_id="test-instance",
            current_version="1.0.0",
            is_setup_done=True,
            last_checked_at=timezone.now(),
        )
        owner = _member(workspace, "owner", role=20)
        InstanceAdmin.objects.create(instance=instance, user=owner, role=20)
        workspace_admin = _member(workspace, "wsadmin", role=20)

        assert _reset(_client(workspace_admin), workspace, owner).status_code == status.HTTP_403_FORBIDDEN
        owner.refresh_from_db()
        assert owner.check_password(OLD_PASSWORD)

        # another instance admin may
        InstanceAdmin.objects.create(instance=instance, user=workspace_admin, role=20)
        assert _reset(_client(workspace_admin), workspace, owner).status_code == status.HTTP_200_OK

    def test_anonymous_is_refused(self, workspace):
        ada = _member(workspace, "ada")
        response = _reset(APIClient(), workspace, ada)
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
