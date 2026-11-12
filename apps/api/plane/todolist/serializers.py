# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from plane.app.serializers.base import BaseSerializer
from plane.db.models import IssueType

from .models import IssueAcceptanceCriterion


class IssueAcceptanceCriterionSerializer(BaseSerializer):
    class Meta:
        model = IssueAcceptanceCriterion
        fields = ["id", "issue", "text", "is_done", "sort_order", "created_at", "updated_at"]
        read_only_fields = ["id", "issue", "created_at", "updated_at"]

    def validate_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Text cannot be empty")
        return value


class WorkItemTypeSerializer(BaseSerializer):
    key = serializers.SerializerMethodField()

    class Meta:
        model = IssueType
        fields = ["id", "name", "key", "is_default", "level"]
        read_only_fields = fields

    def get_key(self, obj):
        return (obj.logo_props or {}).get("key")
