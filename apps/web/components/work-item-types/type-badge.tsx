/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { cn } from "@plane/utils";
// services
import type { TWorkItemType } from "@/services/todolist.service";

/** Marker color per type key. A type without a known key gets the neutral marker. */
const MARKER_CLASS_NAMES: Record<string, string> = {
  task: "bg-[#2f6fb5]",
  bug: "bg-[#c8372d]",
  story: "bg-[#7a5ac0]",
  feature: "bg-[#7ba317]",
};

type Props = {
  type: TWorkItemType;
  className?: string;
};

export function WorkItemTypeMarker(props: { type: TWorkItemType }) {
  const { type } = props;
  return (
    <span
      aria-hidden
      className={cn("size-2.5 shrink-0 rounded-xs", MARKER_CLASS_NAMES[type.key ?? ""] ?? "bg-layer-3")}
    />
  );
}

/** The type of a work item as a small colored marker followed by its name. */
export function WorkItemTypeBadge(props: Props) {
  const { type, className } = props;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <WorkItemTypeMarker type={type} />
      {type.name}
    </span>
  );
}
