/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { useTranslation } from "@plane/i18n";
import type { TStateGroups } from "@plane/types";
// local imports
import { GROUP_COLORS } from "./palette";

type Props = {
  groups: TStateGroups[];
  /** Number of work items per column, after the board's filters. */
  counts: Record<TStateGroups, number>;
  /** Total story points of the work items on the board. */
  points: number;
};

/**
 * How the work on the board is spread over its columns, as one bar in the columns' colors. A
 * segment grows or shrinks when a card moves, so the bar answers a drag as the columns do.
 */
export function FlowStrip(props: Props) {
  const { groups, counts, points } = props;
  // translation
  const { t } = useTranslation();

  const total = groups.reduce((sum, group) => sum + counts[group], 0);
  if (total === 0) return null;

  // Cancelled work is not part of what had to be done.
  const planned = total - (counts.cancelled ?? 0);
  const donePercent = planned > 0 ? Math.round(((counts.completed ?? 0) / planned) * 100) : 0;

  return (
    <div className="flex items-center gap-4">
      <p className="flex-shrink-0 text-body-sm-semibold whitespace-nowrap text-primary">
        {t("general_board.flow.items", { count: total })}
        {points > 0 && (
          <span className="ml-2 text-body-xs-regular text-secondary">{t("story_points.value", { points })}</span>
        )}
      </p>
      <div
        role="img"
        aria-label={groups.map((group) => `${t(`general_board.groups.${group}`)}: ${counts[group]}`).join(", ")}
        className="flex h-2.5 min-w-24 flex-1 gap-0.5 overflow-hidden rounded-full"
      >
        {groups.map((group) =>
          counts[group] > 0 ? (
            <span
              key={group}
              title={`${t(`general_board.groups.${group}`)}: ${counts[group]}`}
              className="h-full min-w-1.5 transition-[flex-grow] duration-300 ease-out motion-reduce:transition-none"
              style={{ flexGrow: counts[group], flexBasis: 0, backgroundColor: GROUP_COLORS[group].color }}
            />
          ) : null
        )}
      </div>
      <p className="flex-shrink-0 text-body-xs-medium whitespace-nowrap text-secondary">
        {t("general_board.flow.done", { percent: donePercent })}
      </p>
    </div>
  );
}
