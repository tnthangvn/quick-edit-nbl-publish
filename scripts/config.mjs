/**
 * Release config = release.config.json (committed, no local paths)
 *                + release.local.json (gitignored: where the private source repo lives on this machine).
 * SOURCE_REPO env overrides release.local.json.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHARED_FILE = path.join(ROOT, "release.config.json");
const LOCAL_FILE = path.join(ROOT, "release.local.json");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function loadConfig() {
  const local = existsSync(LOCAL_FILE) ? readJson(LOCAL_FILE) : {};
  const sourceRepo = process.env.SOURCE_REPO ?? local.sourceRepo;
  if (!sourceRepo) {
    throw new Error("Source repo not set: run `make init SOURCE=/path/to/source-repo` (writes release.local.json) or set SOURCE_REPO");
  }
  if (!existsSync(path.join(sourceRepo, ".git"))) throw new Error(`Source repo is not a git checkout: ${sourceRepo}`);
  return { ...readJson(SHARED_FILE), ...local, sourceRepo };
}
