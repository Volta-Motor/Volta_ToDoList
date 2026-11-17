# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""'Danışmanda' durumu.

İş, ekipten çıkıp danışmana geçtiğinde 'Devam ediyor' ile 'Tamamlandı' arasında
ayrı bir sütunda görünür. Plane'de sütunlar proje durumlarından gelir; bu yüzden
her projede 'başlamış' grubunda bir 'Danışmanda' durumu bulunur.

Durum adıyla değil işaretiyle tanınır (`external_source`/`external_id`): proje
ayarlarından adı değiştirilse de tahtadaki sütun onu bulmaya devam eder.
"""

# Module imports
from plane.db.models import State

CONSULTANT_SOURCE = "todolist"
CONSULTANT_ID = "consultant"

CONSULTANT_STATE = {
    "name": "Danışmanda",
    "color": "#6548B8",
    # 'In Progress' 35000, 'Done' 45000: proje tahtasında ikisinin arasına düşer
    "sequence": 40000,
    "group": "started",
}


def ensure_consultant_state(project):
    """Projede 'Danışmanda' durumu yoksa oluşturur; aynı adla açılmış bir durum varsa onu işaretler."""
    states = State.objects.filter(project_id=project.id)
    if states.filter(external_source=CONSULTANT_SOURCE, external_id=CONSULTANT_ID).exists():
        return

    same_name = states.filter(name__iexact=CONSULTANT_STATE["name"]).first()
    if same_name is not None:
        State.objects.filter(pk=same_name.pk).update(external_source=CONSULTANT_SOURCE, external_id=CONSULTANT_ID)
        return

    State.objects.create(
        project=project,
        workspace_id=project.workspace_id,
        external_source=CONSULTANT_SOURCE,
        external_id=CONSULTANT_ID,
        **CONSULTANT_STATE,
    )
