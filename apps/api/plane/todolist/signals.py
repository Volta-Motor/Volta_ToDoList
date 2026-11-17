# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.models.signals import post_save
from django.dispatch import receiver

# Module imports
from plane.db.models import Project

from .consultant_state import ensure_consultant_state
from .story_points import ensure_story_point_estimate


@receiver(post_save, sender=Project, dispatch_uid="todolist_story_point_estimate")
def add_story_point_estimate(sender, instance, created, raw=False, **kwargs):
    # `raw`: fixture yüklemesi; ilişkili kayıtlar henüz yerinde olmayabilir.
    if created and not raw:
        ensure_story_point_estimate(instance)


@receiver(post_save, sender=Project, dispatch_uid="todolist_consultant_state")
def add_consultant_state(sender, instance, created, raw=False, **kwargs):
    # Plane'in varsayılan durumları projeden hemen sonra kendisi eklenir; adları farklı olduğu
    # için bu kayıtla çakışmaz.
    if created and not raw:
        ensure_consultant_state(instance)
