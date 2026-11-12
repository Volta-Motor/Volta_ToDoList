# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.apps import AppConfig


class TodoListConfig(AppConfig):
    """TO DO List'e özgü, Plane'de bulunmayan özellikler.

    Plane'in kendi modelleri `plane.db` içinde durur. Buradaki modeller ayrı bir
    uygulamada tutulur ki migration'ları Plane'in migration zinciriyle çakışmasın
    ve Plane'in yeni sürümleri kolayca alınabilsin.
    """

    name = "plane.todolist"
    label = "todolist"

    def ready(self):
        from . import signals  # noqa: F401
