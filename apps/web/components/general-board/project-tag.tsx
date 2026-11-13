/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TProjectTag = {
  identifier: string;
  background: string;
  text: string;
  border: string;
};

/**
 * Tag colors cycle through this list in project order, so each project keeps one color across the
 * board. Eight clearly different hues, each dark enough for white text.
 */
const PROJECT_TAG_COLORS: Omit<TProjectTag, "identifier">[] = [
  // the navy tag keeps a lighter outline so it does not vanish on the dark theme
  { background: "#14212D", text: "#FFFFFF", border: "#405C72" },
  { background: "#557211", text: "#FFFFFF", border: "#557211" },
  { background: "#1F6FA8", text: "#FFFFFF", border: "#1F6FA8" },
  { background: "#B5432F", text: "#FFFFFF", border: "#B5432F" },
  { background: "#6548B8", text: "#FFFFFF", border: "#6548B8" },
  { background: "#0E7C73", text: "#FFFFFF", border: "#0E7C73" },
  { background: "#94610A", text: "#FFFFFF", border: "#94610A" },
  { background: "#A63A78", text: "#FFFFFF", border: "#A63A78" },
];

export const getProjectTag = (identifier: string, index: number): TProjectTag => ({
  identifier,
  ...PROJECT_TAG_COLORS[index % PROJECT_TAG_COLORS.length],
});

type Props = {
  tag: TProjectTag;
  title?: string;
};

export function ProjectTag(props: Props) {
  const { tag, title } = props;

  return (
    <span
      title={title}
      className="font-mono inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] leading-none font-semibold"
      style={{ backgroundColor: tag.background, color: tag.text, borderColor: tag.border }}
    >
      {tag.identifier}
    </span>
  );
}
