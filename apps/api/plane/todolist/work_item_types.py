# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Çalışma alanının iş türleri.

Plane'in veri modelinde `IssueType` tablosu ve `Issue.type` alanı vardır ama
Community sürümünde bunları yöneten bir uç nokta yoktur. Burada her çalışma
alanına sabit dört tür tanımlanır.
"""

# Django imports
from django.db import transaction

# Module imports
from plane.db.models import IssueType, Workspace

# Sıra, türlerin arayüzde gösterileceği sıradır. `key` arayüzde renk ve simge
# seçmek için kullanılır ve `logo_props` içinde saklanır.
DEFAULT_WORK_ITEM_TYPES = [
    {"key": "task", "name": "Görev", "is_default": True},
    {"key": "bug", "name": "Hata", "is_default": False},
    {"key": "story", "name": "Kullanıcı hikâyesi", "is_default": False},
    {"key": "feature", "name": "Özellik", "is_default": False},
]


def work_item_types_for(workspace_id):
    return IssueType.objects.filter(workspace_id=workspace_id, is_active=True, is_epic=False).order_by(
        "level", "created_at"
    )


def ensure_default_work_item_types(workspace_id):
    """Çalışma alanında hiç iş türü yoksa varsayılanları oluşturur.

    Çalışma alanı satırı kilitlenir; böylece aynı anda gelen iki istek türleri
    iki kez oluşturamaz.
    """
    if work_item_types_for(workspace_id).exists():
        return
    with transaction.atomic():
        Workspace.objects.select_for_update().get(pk=workspace_id)
        if IssueType.objects.filter(workspace_id=workspace_id).exists():
            return
        IssueType.objects.bulk_create(
            [
                IssueType(
                    workspace_id=workspace_id,
                    name=item["name"],
                    is_default=item["is_default"],
                    level=index,
                    logo_props={"key": item["key"]},
                )
                for index, item in enumerate(DEFAULT_WORK_ITEM_TYPES)
            ]
        )


def default_work_item_type(workspace_id):
    ensure_default_work_item_types(workspace_id)
    return work_item_types_for(workspace_id).filter(is_default=True).first()
