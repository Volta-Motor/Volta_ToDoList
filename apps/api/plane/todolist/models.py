# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import models

# Module imports
from plane.db.models.project import ProjectBaseModel


class CriterionKind(models.TextChoices):
    ACCEPTANCE = "acceptance", "Acceptance"
    TEST = "test", "Test"


class IssueAcceptanceCriterion(ProjectBaseModel):
    """Bir iş öğesinin kabul ya da test kriterleri listesindeki tek bir madde.

    İki liste aynı tabloda tutulur ve `kind` alanıyla ayrılır. Tablo adı ilk
    sürümden kalmadır; yalnızca kabul kriterleriyle başlamıştı.
    """

    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="acceptance_criteria")
    kind = models.CharField(max_length=20, choices=CriterionKind.choices, default=CriterionKind.ACCEPTANCE)
    text = models.CharField(max_length=500)
    is_done = models.BooleanField(default=False)
    sort_order = models.FloatField(default=65535)

    class Meta:
        verbose_name = "Issue Acceptance Criterion"
        verbose_name_plural = "Issue Acceptance Criteria"
        db_table = "issue_acceptance_criteria"
        ordering = ("sort_order", "created_at")

    def __str__(self):
        return f"{self.issue_id} {self.text}"
