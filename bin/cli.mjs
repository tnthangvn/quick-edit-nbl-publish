#!/usr/bin/env node
/**
 * Start the bundled Next.js standalone server.
 *
 *   quick-edit-nbl [--port <n>] [--host <name>]
 *
 * Env: .env / .env.local in the current directory are loaded if present (existing env wins).
 * PORT and HOSTNAME are read by the Next server; flags override them.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_PORT = "3021";
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

loadEnvFiles();
process.env.NODE_ENV = "production";
process.env.NEXT_TELEMETRY_DISABLED ??= "1";
process.env.PORT = flags.port ?? process.env.PORT_START ?? process.env.PORT ?? DEFAULT_PORT;
process.env.HOSTNAME = flags.host ?? DEFAULT_HOST;

console.log(`Starting on http://${process.env.HOSTNAME}:${process.env.PORT}`);
await import(pathToFileURL(path.join(APP_DIR, "server.js")).href);
