# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Story point (Fibonacci) tahmini.

Plane'de tahmin sistemi proje bazında elle açılır. TO DO List'te her proje,
oluşturulduğu anda Fibonacci dizisine göre bir story point sistemiyle gelir;
böylece iş öğelerine ek ayar yapmadan puan verilebilir.
"""

# Django imports
from django.core.cache import cache
from django.db import transaction

# Module imports
from plane.db.models import Estimate, EstimatePoint, Project

STORY_POINT_ESTIMATE_NAME = "Story point"
FIBONACCI_POINTS = ["1", "2", "3", "5", "8", "13", "21"]


def _clear_workspace_estimates_cache(workspace_slug):
    """Çalışma alanı tahmin listesi kullanıcı başına iki saat önbellekte tutulur.

    Yeni projenin puan sistemi hemen görünsün diye o yanıtlar silinir. Anahtar
    araması yalnızca Redis önbelleğinde vardır; başka önbelleklerde (testler)
    silinecek bir şey de yoktur.
    """
    keys = getattr(cache, "keys", None)
    if keys is None:
        return
    cache.delete_many(keys(f"*/api/workspaces/{workspace_slug}/estimates/*"))


def ensure_story_point_estimate(project):
    """Projenin etkin bir tahmin sistemi yoksa Fibonacci story point sistemini kurar."""
    if project.estimate_id:
        return

    with transaction.atomic():
        estimate, _ = Estimate.objects.get_or_create(
            project=project,
            name=STORY_POINT_ESTIMATE_NAME,
            defaults={"type": "points", "last_used": True},
        )
        if not estimate.points.exists():
            EstimatePoint.objects.bulk_create(
                [
                    EstimatePoint(
                        estimate=estimate,
                        key=index,
                        value=value,
                        project=project,
                        workspace_id=project.workspace_id,
                    )
                    for index, value in enumerate(FIBONACCI_POINTS, start=1)
                ]
            )
        # `update` kullanılır: `save` proje sinyalini yeniden tetiklerdi.
        Project.objects.filter(pk=project.pk, estimate__isnull=True).update(estimate=estimate)
        project.estimate = estimate

    _clear_workspace_estimates_cache(project.workspace.slug)
