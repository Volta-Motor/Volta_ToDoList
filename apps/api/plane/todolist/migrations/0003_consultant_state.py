# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations
from django.utils.text import slugify

NAME = "Danışmanda"
SOURCE = "todolist"
MARK = "consultant"


def add_consultant_states(apps, schema_editor):
    """Give every existing project the 'Danışmanda' state.

    New projects get it from the project signal; this covers projects created before it existed.
    A state someone already created under the same name is marked rather than duplicated.
    """
    Project = apps.get_model("db", "Project")
    State = apps.get_model("db", "State")

    for project in Project.objects.filter(deleted_at__isnull=True).iterator():
        states = State.objects.filter(project_id=project.id, deleted_at__isnull=True)
        if states.filter(external_source=SOURCE, external_id=MARK).exists():
            continue
        same_name = states.filter(name__iexact=NAME).first()
        if same_name is not None:
            State.objects.filter(pk=same_name.pk).update(external_source=SOURCE, external_id=MARK)
            continue
        State.objects.create(
            project_id=project.id,
            workspace_id=project.workspace_id,
            name=NAME,
            slug=slugify(NAME),
            color="#6548B8",
            sequence=40000,
            group="started",
            external_source=SOURCE,
            external_id=MARK,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("todolist", "0002_criterion_kind"),
    ]

    operations = [
        migrations.RunPython(add_consultant_states, migrations.RunPython.noop),
    ]
