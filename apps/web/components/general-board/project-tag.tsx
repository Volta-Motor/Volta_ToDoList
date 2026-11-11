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

/** Tag colors cycle through this list in project order, so each project keeps one color across the board. */
const PROJECT_TAG_COLORS: Omit<TProjectTag, "identifier">[] = [
  { background: "#14212D", text: "#FFFFFF", border: "#14212D" },
  { background: "#DCEDB0", text: "#14212D", border: "#7BA317" },
  { background: "#E6EBEF", text: "#14212D", border: "#6A8296" },
  { background: "#2C4457", text: "#FFFFFF", border: "#2C4457" },
  { background: "#E2DED0", text: "#14212D", border: "#6A8296" },
  { background: "#C3E07B", text: "#14212D", border: "#5F7E12" },
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
