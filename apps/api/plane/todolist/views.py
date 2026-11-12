# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ProjectEntityPermission, WorkspaceEntityPermission, issue_hidden_from_guest
from plane.app.views.base import BaseAPIView, BaseViewSet
from plane.db.models import Issue, Workspace

from .models import CriterionKind, IssueAcceptanceCriterion
from .serializers import IssueAcceptanceCriterionSerializer, WorkItemTypeSerializer
from .work_item_types import ensure_default_work_item_types, work_item_types_for


class IssueAcceptanceCriterionViewSet(BaseViewSet):
    """Bir iş öğesinin kabul ve test kriterleri (`kind` alanıyla ayrılır).

    İş bağlantılarıyla (issue links) aynı yetki kuralları geçerlidir: proje
    üyeleri okuyabilir, yönetici ve üyeler değiştirebilir, kısıtlı misafirler
    yalnızca kendi açtıkları işlerin kriterlerine ulaşabilir.
    """

    permission_classes = [ProjectEntityPermission]

    model = IssueAcceptanceCriterion
    serializer_class = IssueAcceptanceCriterionSerializer

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if issue_hidden_from_guest(request, kwargs["slug"], kwargs["project_id"], kwargs["issue_id"]):
            raise PermissionDenied("You are not allowed to view this issue")

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(issue_id=self.kwargs.get("issue_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .order_by("sort_order", "created_at")
            .distinct()
        )

    def list(self, request, slug, project_id, issue_id):
        serializer = IssueAcceptanceCriterionSerializer(self.get_queryset(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request, slug, project_id, issue_id):
        # URL'deki iş, URL'deki çalışma alanına ve projeye ait olmalı (değilse 404).
        Issue.objects.get(pk=issue_id, workspace__slug=slug, project_id=project_id)
        serializer = IssueAcceptanceCriterionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        extra = {}
        if "sort_order" not in request.data:
            kind = serializer.validated_data.get("kind", CriterionKind.ACCEPTANCE)
            last = (
                self.get_queryset()
                .filter(kind=kind)
                .order_by("-sort_order")
                .values_list("sort_order", flat=True)
                .first()
            )
            extra["sort_order"] = (last or 0) + 10000
        serializer.save(project_id=project_id, issue_id=issue_id, **extra)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, slug, project_id, issue_id, pk):
        criterion = self.get_queryset().get(pk=pk)
        serializer = IssueAcceptanceCriterionSerializer(criterion, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, slug, project_id, issue_id, pk):
        self.get_queryset().get(pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkItemTypesEndpoint(BaseAPIView):
    """Çalışma alanının iş türleri (Görev, Hata, Kullanıcı hikâyesi, Özellik)."""

    permission_classes = [WorkspaceEntityPermission]

    def get(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        ensure_default_work_item_types(workspace.id)
        serializer = WorkItemTypeSerializer(work_item_types_for(workspace.id), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
