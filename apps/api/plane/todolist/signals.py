# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.models.signals import post_save
from django.dispatch import receiver

# Module imports
from plane.db.models import Project

from .story_points import ensure_story_point_estimate


@receiver(post_save, sender=Project, dispatch_uid="todolist_story_point_estimate")
def add_story_point_estimate(sender, instance, created, raw=False, **kwargs):
    # `raw`: fixture yüklemesi; ilişkili kayıtlar henüz yerinde olmayabilir.
    if created and not raw:
        ensure_story_point_estimate(instance)
