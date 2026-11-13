# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Otomatik proje üyeliği.

Plane'de bir kişi çalışma alanına katıldıktan sonra her projeye ayrıca
eklenmelidir; eklenmediği projenin işlerini göremez. TO DO List ekip içi tek
board olarak kullanıldığı için çalışma alanının yönetici ve üyeleri bütün
projelerin de üyesidir.

Bu, kişi proje listesini istediğinde (uygulama her açılışta ister) sağlanır:
üyesi olmadığı projelere o anda eklenir. Böylece yeni katılan kişi de, sonradan
açılan proje de ek bir adım gerektirmeden kapsanır.

- Kimin çalışma alanına gireceği yine davetle belirlenir.
- Misafir (guest) rolü bilerek kısıtlıdır ve otomatik eklenmez.
- Bir projeden elle çıkarılan kişi yeniden eklenmez: üyelik kaydı (pasif
  olarak) durduğu sürece dokunulmaz.
- `TODOLIST_AUTO_PROJECT_MEMBERSHIP=0` ortam değişkeniyle kapatılabilir.
"""

# Python imports
import os
from datetime import timedelta

# Django imports
from django.db import IntegrityError, transaction
from django.utils import timezone

# Module imports
from plane.db.models import Project, ProjectMember, WorkspaceMember

# Otomatik eklenen çalışma alanı rolleri; projede aynı rol verilir (20 yönetici, 15 üye).
AUTO_JOIN_ROLES = (20, 15)

# Yeni açılmış proje bir sonraki istekte ele alınır: Plane projeyi açan kişiyi ve proje
# liderini proje kaydından hemen sonra kendisi ekler; o sırada araya girilirse aynı
# üyelik iki kez yazılmaya çalışılır ve proje oluşturma hata verir.
NEW_PROJECT_GRACE = timedelta(seconds=10)


def is_enabled():
    return os.environ.get("TODOLIST_AUTO_PROJECT_MEMBERSHIP", "1") != "0"


def join_workspace_projects(user, workspace_slug):
    """Kişiyi, çalışma alanında üyesi olmadığı bütün projelere ekler. Eklenen proje sayısını döner."""
    if not is_enabled() or getattr(user, "is_bot", False):
        return 0

    workspace_member = WorkspaceMember.objects.filter(
        workspace__slug=workspace_slug, member=user, is_active=True, role__in=AUTO_JOIN_ROLES
    ).first()
    if workspace_member is None:
        return 0

    # Pasif kayıtlar da sayılır: projeden çıkarılmış kişi yeniden eklenmez.
    known = ProjectMember.objects.filter(workspace_id=workspace_member.workspace_id, member=user).values("project_id")
    missing = (
        Project.objects.filter(workspace_id=workspace_member.workspace_id, archived_at__isnull=True)
        .exclude(pk__in=known)
        .exclude(created_at__gte=timezone.now() - NEW_PROJECT_GRACE)
    )

    added = 0
    for project in missing:
        try:
            with transaction.atomic():
                # `save` üzerinden: ProjectMember.save kişinin proje görünüm ayarlarını da oluşturur.
                ProjectMember.objects.create(
                    project=project,
                    workspace_id=project.workspace_id,
                    member=user,
                    role=workspace_member.role,
                )
            added += 1
        except IntegrityError:
            # Aynı anda başka bir istek eklemiş; yapılacak bir şey yok.
            continue
    return added
