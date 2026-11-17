/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// plane imports
import { ConfirmDialog } from "@plane/blocks/dialog";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import { copyTextToClipboard } from "@plane/utils";
// services
import { TodoListService } from "@/services/todolist.service";

const todoListService = new TodoListService();

type Props = {
  workspaceSlug: string;
  member: { id: string; display_name: string };
  onClose: () => void;
};

/**
 * Lets a workspace admin give a member a temporary password. It asks first, because the member's
 * current password stops working, then shows the new password once so it can be passed on.
 */
export function ResetMemberPasswordDialog(props: Props) {
  const { workspaceSlug, member, onClose } = props;
  // states
  const [isResetting, setIsResetting] = useState(false);
  const [password, setPassword] = useState<string | undefined>(undefined);
  // translation
  const { t } = useTranslation();

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const result = await todoListService.resetMemberPassword(workspaceSlug, member.id);
      setPassword(result.password);
    } catch {
      setToast({ type: "error", title: t("member_password_reset.failed") });
    } finally {
      setIsResetting(false);
    }
  };

  const handleCopy = async () => {
    if (!password) return;
    await copyTextToClipboard(password);
    setToast({ type: "success", title: t("member_password_reset.copied") });
  };

  if (password)
    return (
      <ConfirmDialog
        isOpen
        variant="primary"
        hideIcon
        isSubmitting={false}
        handleClose={onClose}
        handleSubmit={handleCopy}
        title={t("member_password_reset.done_title")}
        content={
          <span className="flex flex-col gap-3">
            <span>{t("member_password_reset.done_description", { name: member.display_name })}</span>
            <code className="rounded-md border border-subtle bg-layer-1 px-3 py-2 text-center text-body-md-medium tracking-wide text-primary select-all">
              {password}
            </code>
          </span>
        }
        primaryButtonText={{ default: t("member_password_reset.copy") }}
        secondaryButtonText={t("member_password_reset.close")}
      />
    );

  return (
    <ConfirmDialog
      isOpen
      variant="warning"
      isSubmitting={isResetting}
      handleClose={onClose}
      handleSubmit={handleReset}
      title={t("member_password_reset.confirm_title", { name: member.display_name })}
      content={t("member_password_reset.confirm_description")}
      primaryButtonText={{ default: t("member_password_reset.action"), loading: t("member_password_reset.resetting") }}
      secondaryButtonText={t("cancel")}
    />
  );
}
