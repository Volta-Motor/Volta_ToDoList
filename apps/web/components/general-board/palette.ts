/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { TStateGroups } from "@plane/types";

type TGroupColor = {
  /** The color of the column: its top edge, count badge and its share of the flow strip. */
  color: string;
  /** Text color that stays readable on `color`. */
  onColor: string;
};

/**
 * One color per column, running from cool to warm to the brand green as work moves towards done.
 * The colors come from the approved design's palette.
 */
export const GROUP_COLORS: Record<TStateGroups, TGroupColor> = {
  backlog: { color: "#8A9BAA", onColor: "#14212D" },
  unstarted: { color: "#1F6FA8", onColor: "#FFFFFF" },
  started: { color: "#E0A400", onColor: "#14212D" },
  completed: { color: "#7BA317", onColor: "#14212D" },
  cancelled: { color: "#C8372D", onColor: "#FFFFFF" },
};

/** `color` mixed into a theme surface, so tints follow the light and dark themes. */
export const tint = (color: string, percent: number, surface = "var(--bg-layer-1)") =>
  `color-mix(in srgb, ${color} ${percent}%, ${surface})`;
