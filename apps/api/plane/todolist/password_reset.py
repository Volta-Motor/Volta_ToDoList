# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Yöneticinin bir üyeye geçici parola ataması.

Plane'de parolayı yalnızca kişinin kendisi sıfırlayabilir ve bunun için
e-posta sunucusu gerekir. Ekip içi kurulumda çalışma alanı yöneticisi, parolasını
unutan bir üyeye geçici parola atayabilir. Parolayı sunucu üretir ve yanıtla bir
kez döner; hiçbir yere yazılmaz.
"""

# Python imports
import logging
import secrets

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import WorkspaceOwnerPermission
from plane.app.views.base import BaseAPIView
from plane.db.models import User, WorkspaceMember
from plane.license.models import InstanceAdmin

logger = logging.getLogger("plane.api")

# Birbirine benzeyen karakterler (0/O, 1/l/I) yok: parola elden ele, okunarak iletilir.
ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_temporary_password():
    """Dört karakterlik beş öbek, örn. `Xk7m-Qp2v-9RtB-w4Hn-3fTz`."""
    return "-".join("".join(secrets.choice(ALPHABET) for _ in range(4)) for _ in range(5))


class WorkspaceMemberPasswordResetEndpoint(BaseAPIView):
    """Çalışma alanı yöneticisi, alanın bir üyesine geçici parola atar."""

    permission_classes = [WorkspaceOwnerPermission]

    def post(self, request, slug, user_id):
        if str(request.user.id) == str(user_id):
            return Response(
                {"error": "Use your profile settings to change your own password"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Yalnızca bu çalışma alanının etkin üyesi olan gerçek kişiler
        membership = (
            WorkspaceMember.objects.filter(
                workspace__slug=slug, member_id=user_id, is_active=True, member__is_bot=False
            )
            .select_related("member")
            .first()
        )
        if membership is None:
            return Response({"error": "Member not found in this workspace"}, status=status.HTTP_404_NOT_FOUND)

        # Kurulum yöneticisinin hesabını yalnızca başka bir kurulum yöneticisi sıfırlayabilir;
        # yoksa çalışma alanı yöneticiliği kurulumun tamamına erişime dönüşürdü.
        target_is_instance_admin = InstanceAdmin.objects.filter(user_id=user_id).exists()
        requester_is_instance_admin = InstanceAdmin.objects.filter(user=request.user).exists()
        if target_is_instance_admin and not requester_is_instance_admin:
            return Response(
                {"error": "Only an instance admin can reset the password of an instance admin"},
                status=status.HTTP_403_FORBIDDEN,
            )

        password = generate_temporary_password()
        user = User.objects.get(pk=membership.member_id)
        # Parola değişince kişinin açık oturumları da geçersiz olur.
        user.set_password(password)
        user.is_password_autoset = False
        user.save()

        logger.info(
            "Workspace admin reset a member's password",
            extra={"workspace": slug, "reset_by": str(request.user.id), "reset_for": str(user.id)},
        )
        return Response({"password": password}, status=status.HTTP_200_OK)
