#!/usr/bin/env bash
# Commit dist/ (built by scripts/build-release.mjs) onto the orphan `release` branch and push it with a v<version> tag.
# GitHub Actions on `release` (release-branch/.github/workflows/publish.yml) then publishes to npm.
#
#   scripts/push-release.sh [--no-push]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="release"
REMOTE="origin"
WORKTREE="$ROOT/.work/release-branch"
PUSH=1
[[ "${1:-}" == "--no-push" ]] && PUSH=0

cd "$ROOT"
[[ -f dist/package.json && -f .work/release.json ]] || { echo "dist/ missing: run 'npm run build' first" >&2; exit 1; }

VERSION="$(node -p 'require("./dist/package.json").version')"
COMMIT="$(node -p 'require("./.work/release.json").commit')"
TAG="v$VERSION"

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || git ls-remote --exit-code --tags "$REMOTE" "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists: bump the version (source package.json or --version) first" >&2
  exit 1
fi

git worktree remove --force "$WORKTREE" 2>/dev/null || true
rm -rf "$WORKTREE"
git fetch "$REMOTE" "$BRANCH" 2>/dev/null || true
if git rev-parse -q --verify "refs/remotes/$REMOTE/$BRANCH" >/dev/null; then
  git worktree add -B "$BRANCH" "$WORKTREE" "$REMOTE/$BRANCH"
elif git rev-parse -q --verify "refs/heads/$BRANCH" >/dev/null; then
  git worktree add "$WORKTREE" "$BRANCH"
else
  git worktree add --orphan -b "$BRANCH" "$WORKTREE"
fi

# Replace the whole tree: release branch = exactly dist/ + CI workflow, nothing else.
find "$WORKTREE" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a dist/. "$WORKTREE/"
cp -a release-branch/. "$WORKTREE/"

cd "$WORKTREE"
git add -A
if git diff --cached --quiet; then
  echo "Nothing changed on $BRANCH"
else
  git commit -q -m "release: $TAG (source ${COMMIT:0:7})"
fi
git tag -a "$TAG" -m "$TAG (source $COMMIT)"
echo "Committed $TAG on $BRANCH"

if (( PUSH )); then
  git push "$REMOTE" "$BRANCH" "$TAG"
  echo "Pushed: GitHub Actions will publish $TAG to npm"
else
  echo "Skipped push. To push later: git -C '$WORKTREE' push $REMOTE $BRANCH $TAG"
fi
