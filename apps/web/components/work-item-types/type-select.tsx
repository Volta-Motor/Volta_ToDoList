/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { ChevronDownOutline } from "@makeplane/propel/icons";
// plane imports
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
// local imports
import { WorkItemTypeBadge, WorkItemTypeMarker } from "./type-badge";
import { useWorkItemTypes } from "./use-work-item-types";

type Props = {
  workspaceSlug: string;
  value: string | null | undefined;
  onChange: (typeId: string) => void;
  disabled?: boolean;
};

/** Shows the type of a work item and, unless disabled, lets the user pick another one. */
export function WorkItemTypeSelect(props: Props) {
  const { workspaceSlug, value, onChange, disabled = false } = props;
  // translation
  const { t } = useTranslation();
  // data
  const { types, getTypeById } = useWorkItemTypes(workspaceSlug);
  const selectedType = getTypeById(value);

  if (types.length === 0) return null;

  const label = selectedType ? (
    <WorkItemTypeBadge type={selectedType} />
  ) : (
    <span className="text-tertiary">{t("work_item_types.none")}</span>
  );

  if (disabled) return <span className="text-body-xs-medium text-secondary">{label}</span>;

  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label={t("work_item_types.change")}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-body-xs-medium text-secondary",
              "hover:bg-layer-transparent-hover"
            )}
          >
            {label}
            <ChevronDownOutline className="size-3.5 text-tertiary" />
          </button>
        }
      />
      <MenuContent side="bottom" align="start">
        {types.map((type) => (
          <MenuItem
            key={type.id}
            icon={<WorkItemTypeMarker type={type} />}
            label={type.name}
            selected={type.id === value}
            onClick={() => {
              if (type.id !== value) onChange(type.id);
            }}
          />
        ))}
      </MenuContent>
    </Menu>
  );
}
