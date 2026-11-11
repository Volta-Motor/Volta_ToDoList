/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
// local imports
import { VOLTA_GREEN, VOLTA_WINGS_PATH } from "./volta-wings-path";

export type PlaneLockupProps = React.ComponentPropsWithoutRef<"svg">;

/**
 * The product lockup: the Volta wings followed by the "TO DO LIST" wordmark.
 * The wings stay brand green; the wordmark takes `color`, which defaults to the current text color.
 * The component keeps its upstream name so call sites stay untouched.
 */
export function PlaneLockup({ width = "253", height = "53", className, color = "currentColor" }: PlaneLockupProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 253 53"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="TO DO List"
    >
      <g transform="translate(0 15.5) scale(0.5236)">
        <path d={VOLTA_WINGS_PATH} fill={VOLTA_GREEN} fillRule="evenodd" />
      </g>
      <text
        x="112"
        y="35.5"
        fill={color}
        fontFamily="'Inter Variable', Inter, system-ui, sans-serif"
        fontSize="25"
        fontWeight="700"
        textLength="141"
        lengthAdjust="spacingAndGlyphs"
      >
        TO DO LIST
      </text>
    </svg>
  );
}
