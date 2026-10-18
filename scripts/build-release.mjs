#!/usr/bin/env node
/**
 * Build the private source repo from a committed ref and assemble an npm package in dist/
 * that contains only compiled output — no source, no .env, no source maps.
 *
 *   node scripts/build-release.mjs [--ref <git-ref>] [--version <semver>] [--reuse true]
 *
 * Steps: git archive <ref> -> .work/src, force Next `output: "standalone"`, pnpm install + build,
 * copy standalone server (without node_modules) + static + public + runtime assets into dist/app,
 * declare the traced runtime packages as dependencies, then scan dist/ for leaks.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT, loadConfig } from "./config.mjs";

const WORK = path.join(ROOT, ".work");
const SRC = path.join(WORK, "src");
const DIST = path.join(ROOT, "dist");
const APP = path.join(DIST, "app");
const STANDALONE = path.join(SRC, ".next/standalone");
const REQUIRED_NODE_MAJOR = 24;


function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (!key || argv[i + 1] === undefined) throw new Error(`Invalid argument near "${argv[i]}"`);
    args[key] = argv[i + 1];
  }
  return args;
}

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

function capture(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", ...opts }).trim();
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function assertNode() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major !== REQUIRED_NODE_MAJOR) {
    throw new Error(`Need Node ${REQUIRED_NODE_MAJOR} (source engine-strict), got ${process.versions.node}. Run: nvm use ${REQUIRED_NODE_MAJOR}`);
  }
}

function exportSource(ref) {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(SRC, { recursive: true });
  const commit = capture("git", ["-C", config.sourceRepo, "rev-parse", "--verify", `${ref}^{commit}`]);
  const tar = path.join(WORK, "src.tar");
  run("git", ["-C", config.sourceRepo, "archive", "--format=tar", "-o", tar, commit]);
  run("tar", ["-xf", tar, "-C", SRC]);
  rmSync(tar);
  return commit;
}

/** Force standalone output without touching the source repo: `export default wrap(config);` -> spread + output. */
function patchNextConfig() {
  const file = path.join(SRC, "next.config.ts");
  const code = readFileSync(file, "utf8");
  if (/\boutput\s*:\s*["']standalone["']/.test(code)) return;
  const exportLine = /export default (\w+)\((\w+)\);/;
  if (!exportLine.test(code)) throw new Error("next.config.ts changed shape; update exportLine in patchNextConfig()");
  writeFileSync(file, code.replace(exportLine, 'export default $1({ ...$2, output: "standalone" });'));
}

/** Next embeds the absolute build path in its runtime config; replace it so the package does not reveal the build machine. */
function scrubBuildPath() {
  for (const rel of ["server.js", ".next/required-server-files.json"]) {
    const file = path.join(APP, rel);
    writeFileSync(file, readFileSync(file, "utf8").replaceAll(SRC, "/app"));
  }
}

function buildSource() {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", CI: "1" };
  run("corepack", ["pnpm", "install", "--frozen-lockfile"], { cwd: SRC, env });
  run("corepack", ["pnpm", "build"], { cwd: SRC, env });
}

/** "@scope+name@1.0.0_peer..." (pnpm store dir) -> "@scope/name" */
function pnpmDirToName(dir) {
  const name = dir.startsWith("@") ? dir.slice(0, dir.indexOf("@", 1)) : dir.slice(0, dir.indexOf("@"));
  return name.replace("+", "/");
}

/** Runtime deps = direct deps of the source that Next traced into standalone, pinned to the installed version. */
function runtimeDependencies(sourcePkg) {
  const store = path.join(STANDALONE, "node_modules/.pnpm");
  const traced = new Set(readdirSync(store).filter((d) => d !== "node_modules").map(pnpmDirToName));
  const names = Object.keys(sourcePkg.dependencies ?? {}).filter((name) => traced.has(name));
  for (const required of ["next", "react", "react-dom"]) {
    if (!names.includes(required)) throw new Error(`"${required}" was not traced into standalone output`);
  }
  return Object.fromEntries(
    names.sort().map((name) => [name, readJson(path.join(SRC, "node_modules", name, "package.json")).version]),
  );
}

function listAliases(nodeModules) {
  return readdirSync(nodeModules).flatMap((name) =>
    name.startsWith("@") ? readdirSync(path.join(nodeModules, name)).map((sub) => `${name}/${sub}`) : [name],
  );
}

/**
 * Turbopack loads server externals through hashed aliases (.next/node_modules/pg-<hash>) that are
 * symlinks into the pnpm store. The store is not shipped, so replace each symlink with a shim
 * package that re-exports the real dependency, which npm installs for the user's platform.
 */
function writeExternalShims() {
  const source = path.join(STANDALONE, ".next/node_modules");
  if (!existsSync(source)) return;
  for (const alias of listAliases(source)) {
    const target = readJson(path.join(realpathSync(path.join(source, alias)), "package.json"));
    const dir = path.join(APP, ".next/node_modules", alias);
    mkdirSync(dir, { recursive: true });
    const isEsm = target.type === "module";
    const shim = isEsm
      ? `export * from "${target.name}";\nimport * as ns from "${target.name}";\nexport default ns.default ?? ns;\n`
      : `module.exports = require("${target.name}");\n`;
    writeFileSync(path.join(dir, "index.js"), shim);
    writeFileSync(
      path.join(dir, "package.json"),
      `${JSON.stringify({ name: alias, private: true, type: isEsm ? "module" : "commonjs", main: "index.js" }, null, 2)}\n`,
    );
  }
}

/** Copy only what the standalone server needs at runtime (whitelist: tracing also pulls in the whole repo). */
function assembleApp() {
  rmSync(DIST, { recursive: true, force: true });
  if (!existsSync(path.join(STANDALONE, "server.js"))) throw new Error("Build produced no .next/standalone/server.js");
  mkdirSync(APP, { recursive: true });
  cpSync(path.join(STANDALONE, "server.js"), path.join(APP, "server.js"));
  const nextDir = path.join(STANDALONE, ".next");
  cpSync(nextDir, path.join(APP, ".next"), {
    recursive: true,
    filter: (src) => {
      const top = path.relative(nextDir, src).split(path.sep)[0];
      return top !== "node_modules" && top !== "cache" && !src.endsWith(".map") && !src.endsWith(".nft.json");
    },
  });
  writeExternalShims();
  scrubBuildPath();
  cpSync(path.join(SRC, ".next/static"), path.join(APP, ".next/static"), { recursive: true, filter: (src) => !src.endsWith(".map") });
  if (existsSync(path.join(SRC, "public"))) cpSync(path.join(SRC, "public"), path.join(APP, "public"), { recursive: true });
  for (const asset of config.runtimeAssets) cpSync(path.join(SRC, asset), path.join(APP, asset), { recursive: true });
}

function writePackageFiles({ version, commit, dependencies, engines }) {
  const pkg = {
    name: config.packageName,
    version,
    description: config.description,
    license: config.license,
    repository: { type: "git", url: `git+${config.repository}.git` },
    bin: { [config.binName]: "bin/cli.mjs" },
    files: ["bin", "app", "README.md", "LICENSE"],
    engines,
    dependencies,
    buildInfo: { sourceCommit: commit, builtAt: new Date().toISOString() },
  };
  writeFileSync(path.join(DIST, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  cpSync(path.join(ROOT, "template"), DIST, { recursive: true });
  cpSync(path.join(ROOT, "LICENSE"), path.join(DIST, "LICENSE"));
  const cli = path.join(DIST, "bin/cli.mjs");
  writeFileSync(cli, readFileSync(cli, "utf8").replace("__DEFAULT_PORT__", String(config.defaultPort)));
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    return statSync(file).isDirectory() ? walk(file) : [file];
  });
}

/** Fail the build if anything that looks like source or secrets ended up in dist/. */
function scanForLeaks() {
  const forbidden = [
    { test: (rel) => /(^|\/)\.env/.test(rel), why: "env file" },
    { test: (rel) => rel.endsWith(".map"), why: "source map" },
    { test: (rel) => /\.(tsx?|mts|cts)$/.test(rel) && !rel.endsWith(".d.ts"), why: "TypeScript source" },
    { test: (rel) => /^app\/(src|scripts|tests|docs|design-system)\//.test(rel), why: "source directory" },
    { test: (rel) => /(^|\/)(CLAUDE|AGENTS|GEMINI)\.md$/.test(rel), why: "agent notes" },
    { test: (rel) => rel.endsWith(".nft.json"), why: "trace file (lists source paths)" },
    { test: (rel, text) => text.includes(ROOT) || text.includes(config.sourceRepo), why: "build machine path" },
    { test: (rel) => rel.split("/").includes("node_modules") && !rel.startsWith("app/.next/node_modules/"), why: "node_modules" },
  ];
  const leaks = walk(DIST).flatMap((file) => {
    const rel = path.relative(DIST, file).split(path.sep).join("/");
    const text = /\.(js|mjs|json|html|css|txt|md)$/.test(rel) ? readFileSync(file, "utf8") : "";
    return forbidden.filter((rule) => rule.test(rel, text)).map((rule) => `${rel} (${rule.why})`);
  });
  if (leaks.length) throw new Error(`Leak scan failed:\n  ${leaks.join("\n  ")}`);
}

let config;

function main() {
  assertNode();
  config = loadConfig();
  const args = parseArgs(process.argv.slice(2));
  const ref = args.ref ?? config.sourceRef;
  // --reuse true: skip export + build and re-assemble from the previous .work/src (fast iteration)
  const reuse = args.reuse === "true" && existsSync(path.join(WORK, "release.json"));
  const commit = reuse ? readJson(path.join(WORK, "release.json")).commit : exportSource(ref);
  const sourcePkg = readJson(path.join(SRC, "package.json"));
  const version = args.version ?? sourcePkg.version;
  console.log(`Building ${config.packageName}@${version} from source ${ref} (${commit.slice(0, 7)})`);

  if (!reuse) {
    patchNextConfig();
    buildSource();
  }
  assembleApp();
  writePackageFiles({
    version,
    commit,
    dependencies: runtimeDependencies(sourcePkg),
    engines: { node: `>=${REQUIRED_NODE_MAJOR}` },
  });
  scanForLeaks();
  writeFileSync(path.join(WORK, "release.json"), `${JSON.stringify({ version, commit, ref }, null, 2)}\n`);
  console.log(`\nDone: dist/ is ${config.packageName}@${version} (source ${commit.slice(0, 7)})`);
}

try {
  main();
} catch (err) {
  console.error(`\nbuild-release failed: ${err.message}`);
  process.exit(1);
}
