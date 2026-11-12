/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";
import { DeleteOutline } from "@makeplane/propel/icons";
// plane imports
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
// services
import type { TAcceptanceCriterion } from "@/services/todolist.service";

type Props = {
  criterion: TAcceptanceCriterion;
  disabled: boolean;
  onToggle: (isDone: boolean) => void;
  onRename: (text: string) => void;
  onRemove: () => void;
};

export function AcceptanceCriterionItem(props: Props) {
  const { criterion, disabled, onToggle, onRename, onRemove } = props;
  // states
  const [draft, setDraft] = useState<string | null>(null);
  // translation
  const { t } = useTranslation();

  const commitDraft = () => {
    const text = draft?.trim();
    if (text && text !== criterion.text) onRename(text);
    setDraft(null);
  };

  return (
    <li className="group flex min-h-8 items-center gap-2.5 rounded-sm px-1.5 hover:bg-layer-transparent-hover">
      <input
        type="checkbox"
        className="size-4 shrink-0 cursor-pointer accent-(--bg-accent-primary) disabled:cursor-not-allowed"
        checked={criterion.is_done}
        disabled={disabled}
        aria-label={criterion.text}
        onChange={(event) => onToggle(event.target.checked)}
      />
      {draft === null ? (
        <button
          type="button"
          disabled={disabled}
          title={disabled ? undefined : t("acceptance_criteria.edit")}
          className={cn(
            "min-w-0 flex-1 py-1 text-left text-body-sm-regular break-words",
            criterion.is_done ? "text-tertiary line-through" : "text-primary",
            !disabled && "cursor-text"
          )}
          onClick={() => setDraft(criterion.text)}
        >
          {criterion.text}
        </button>
      ) : (
        <input
          // The field only appears after the user clicks the text to edit it.
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          type="text"
          value={draft}
          maxLength={500}
          aria-label={t("acceptance_criteria.edit")}
          className="min-w-0 flex-1 rounded-sm border border-accent-strong bg-surface-1 px-1.5 py-0.5 text-body-sm-regular text-primary outline-none"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitDraft();
            if (event.key === "Escape") setDraft(null);
          }}
        />
      )}
      {!disabled && (
        <span className="shrink-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          <IconButton
            variant="ghost"
            size="sm"
            aria-label={t("acceptance_criteria.delete")}
            icon={<Icon icon={DeleteOutline} />}
            onClick={onRemove}
          />
        </span>
      )}
    </li>
  );
}
