/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
// plane imports
import { cn } from "@plane/utils";

type Props = {
  isSelected: boolean;
  onClick: () => void;
  children: ReactNode;
};

export function FilterChip(props: Props) {
  const { isSelected, onClick, children } = props;

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-caption-md-medium whitespace-nowrap",
        isSelected
          ? "border-accent-strong bg-accent-primary text-on-color"
          : "border-subtle bg-surface-1 text-secondary hover:bg-layer-1-hover"
      )}
    >
      {children}
    </button>
  );
}
