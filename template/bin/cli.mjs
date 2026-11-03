#!/usr/bin/env node
/**
 * Start the bundled Next.js standalone server.
 *
 *   quick-edit-nbl [--port <n>] [--host <name>]
 *
 * Env: .env / .env.local in the current directory are loaded if present (existing env wins).
 * Config and data are kept in the current directory (.env.local, .spec-studio/); in a git repo both are
 * added to .gitignore.
 * PORT and HOSTNAME are read by the Next server; flags override them.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_PORT = "__DEFAULT_PORT__";
const DEFAULT_HOST = "localhost";
const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "app");

function usage() {
  console.log("Usage: quick-edit-nbl [--port <n>] [--host <name>]");
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    }
    if (arg !== "--port" && arg !== "--host") {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(1);
    }
    const value = argv[++i];
    if (!value) {
      console.error(`Missing value for ${arg}`);
      process.exit(1);
    }
    flags[arg.slice(2)] = value;
  }
  return flags;
}

function loadEnvFiles() {
  // .env.local first: loadEnvFile never overrides, so the first file loaded wins.
  for (const name of [".env.local", ".env"]) {
    const file = path.resolve(process.cwd(), name);
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

const flags = parseFlags(process.argv.slice(2));
if (flags.port && !/^\d+$/.test(flags.port)) {
  console.error(`Invalid port: ${flags.port}`);
  process.exit(1);
}

// Already ignored (any rule, e.g. ".env*")? Ask git; without git, fall back to an exact line match.
function isIgnored(dir, entry, lines) {
  try {
    execFileSync("git", ["check-ignore", "-q", entry], { cwd: dir, stdio: "ignore" });
    return true;
  } catch (err) {
    if (err.code !== "ENOENT") return false;
    return lines.includes(entry) || lines.includes(`/${entry}`);
  }
}

function ignoreInGit(dir) {
  if (!existsSync(path.join(dir, ".git"))) return;
  const file = path.join(dir, ".gitignore");
  const lines = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim()) : [];
  const missing = [".spec-studio/", ".env.local"].filter((e) => !isIgnored(dir, e, lines));
  if (missing.length === 0) return;
  const prefix = lines.length && lines[lines.length - 1] !== "" ? "\n" : "";
  appendFileSync(file, `${prefix}# Spec Studio (quick-edit-nbl): local config and data\n${missing.join("\n")}\n`);
  console.log(`Added ${missing.join(", ")} to .gitignore`);
}

ignoreInGit(process.cwd());
loadEnvFiles();
// Config (.env.local) and data (.spec-studio/) live in the folder the command runs from:
// the standalone server chdirs into the package, so pass that folder explicitly.
process.env.SPEC_STUDIO_ROOT ??= process.cwd();
process.env.NODE_ENV = "production";
process.env.NEXT_TELEMETRY_DISABLED ??= "1";
process.env.PORT = flags.port ?? process.env.PORT_START ?? process.env.PORT ?? DEFAULT_PORT;
process.env.HOSTNAME = flags.host ?? DEFAULT_HOST;

console.log(`Starting on http://${process.env.HOSTNAME}:${process.env.PORT}`);
await import(pathToFileURL(path.join(APP_DIR, "server.js")).href);
