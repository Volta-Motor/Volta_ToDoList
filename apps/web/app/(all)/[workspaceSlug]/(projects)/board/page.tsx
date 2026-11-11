/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
// components
import { PageHead } from "@/components/core/page-title";
import { GeneralBoardRoot } from "@/components/general-board/root";

export default function GeneralBoardPage() {
  const { workspaceSlug } = useParams();
  // translation
  const { t } = useTranslation();

  if (!workspaceSlug) return null;

  return (
    <>
      <PageHead title={t("general_board.title")} />
      <GeneralBoardRoot workspaceSlug={workspaceSlug.toString()} />
    </>
  );
}
