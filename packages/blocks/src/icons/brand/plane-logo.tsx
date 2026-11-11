/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
// local imports
import { VOLTA_GREEN, VOLTA_WINGS_PATH } from "./volta-wings-path";

export type PlaneLogoProps = React.ComponentPropsWithoutRef<"svg">;

/** The product mark: the Volta wings. The component keeps its upstream name so call sites stay untouched. */
export function PlaneLogo({ width = "191", height = "42", className, color = VOLTA_GREEN }: PlaneLogoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 191 42"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="TO DO List"
    >
      <path d={VOLTA_WINGS_PATH} fill={color} fillRule="evenodd" />
    </svg>
  );
}
