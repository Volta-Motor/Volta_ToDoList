/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * The built package imports translations from `<package>/locales`, which the repository provides as
 * a symbolic link to `src/locales`. Git on Windows checks a symbolic link out as a small text file
 * unless symlink support is turned on, and a build made from such a checkout (including a Docker
 * build, which copies the working tree) then ships without any translations: every text in the
 * interface shows its key instead.
 *
 * This script runs before the build. When `locales` is not a directory it replaces it with a copy
 * of `src/locales`, so the build no longer depends on how the repository was checked out.
 */

import { cpSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const linkPath = join(packageRoot, "locales");
const sourcePath = join(packageRoot, "src", "locales");

const isDirectory = (path: string): boolean => {
  try {
    // Follows symbolic links, so a working link to the source directory counts.
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

if (!isDirectory(sourcePath)) {
  console.error(`[i18n] Translation source directory is missing: ${sourcePath}`);
  process.exit(1);
}

if (!isDirectory(linkPath)) {
  rmSync(linkPath, { force: true, recursive: true });
  cpSync(sourcePath, linkPath, { recursive: true });
  console.log("[i18n] `locales` was not a directory (symbolic link not checked out); copied src/locales in its place.");
}
