/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Columns of the board. All but one are Plane's state groups; "consultant" is the part of the
 * "started" group that is with the consultant (the state marked so in every project).
 */
export type TBoardColumn = "backlog" | "unstarted" | "started" | "consultant" | "completed" | "cancelled";

/** Mark of the "with the consultant" state, set by the server on one state of every project. */
export const CONSULTANT_STATE_MARK = "consultant";

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
export const GROUP_COLORS: Record<TBoardColumn, TGroupColor> = {
  backlog: { color: "#8A9BAA", onColor: "#14212D" },
  unstarted: { color: "#1F6FA8", onColor: "#FFFFFF" },
  started: { color: "#E0A400", onColor: "#14212D" },
  consultant: { color: "#6548B8", onColor: "#FFFFFF" },
  completed: { color: "#7BA317", onColor: "#14212D" },
  cancelled: { color: "#C8372D", onColor: "#FFFFFF" },
};

/** `color` mixed into a theme surface, so tints follow the light and dark themes. */
export const tint = (color: string, percent: number, surface = "var(--bg-layer-1)") =>
  `color-mix(in srgb, ${color} ${percent}%, ${surface})`;
