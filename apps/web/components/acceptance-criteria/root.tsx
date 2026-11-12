/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
// local imports
import { AcceptanceCriterionItem } from "./item";
import { useAcceptanceCriteria } from "./use-acceptance-criteria";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
  className?: string;
};

/** The acceptance criteria checklist shown under the description of a work item. */
export function AcceptanceCriteriaRoot(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled, className } = props;
  // states
  const [newText, setNewText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  // translation
  const { t } = useTranslation();
  // data
  const { criteria, isLoading, hasError, addCriterion, updateCriterion, removeCriterion } = useAcceptanceCriteria(
    workspaceSlug,
    projectId,
    issueId
  );
  const doneCount = criteria.filter((criterion) => criterion.is_done).length;

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text || isAdding) return;
    setIsAdding(true);
    try {
      if (await addCriterion(text)) setNewText("");
    } finally {
      setIsAdding(false);
    }
  };

  // Nothing to show to someone who can't add criteria when there are none.
  if (disabled && !isLoading && !hasError && criteria.length === 0) return null;

  return (
    <section aria-labelledby={`acceptance-criteria-${issueId}`} className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <h3 id={`acceptance-criteria-${issueId}`} className="text-body-sm-semibold text-primary">
          {t("acceptance_criteria.title")}
        </h3>
        {criteria.length > 0 && (
          <span className="text-caption-md-regular text-tertiary">
            {t("acceptance_criteria.progress", { done: doneCount, total: criteria.length })}
          </span>
        )}
      </div>

      {hasError && <p className="text-body-xs-regular text-tertiary">{t("acceptance_criteria.load_error")}</p>}

      {criteria.length > 0 && (
        <ul className="-mx-1.5 flex flex-col">
          {criteria.map((criterion) => (
            <AcceptanceCriterionItem
              key={criterion.id}
              criterion={criterion}
              disabled={disabled}
              onToggle={(isDone) => void updateCriterion(criterion.id, { is_done: isDone })}
              onRename={(text) => void updateCriterion(criterion.id, { text })}
              onRemove={() => void removeCriterion(criterion.id)}
            />
          ))}
        </ul>
      )}

      {!disabled && !hasError && (
        <input
          type="text"
          value={newText}
          maxLength={500}
          disabled={isAdding}
          placeholder={t("acceptance_criteria.add_placeholder")}
          aria-label={t("acceptance_criteria.add_placeholder")}
          className="h-8 rounded-sm border border-subtle bg-surface-1 px-2.5 text-body-sm-regular text-primary outline-none placeholder:text-placeholder focus:border-accent-strong"
          onChange={(event) => setNewText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleAdd();
          }}
        />
      )}
    </section>
  );
}
