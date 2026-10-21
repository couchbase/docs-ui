#!/bin/sh
# Generate visual-regression baselines from a base ref (default: origin/master)
# without touching your working tree: builds the ref in a temporary git
# worktree, renders its preview, and writes the screenshots into this repo's
# tests/visual/__screenshots__/. Then run `npm run test:visual` on your branch.
set -eu
REF="${1:-origin/master}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'git -C "$ROOT" worktree remove --force "$TMP/wt" >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
git -C "$ROOT" worktree add --detach "$TMP/wt" "$REF"
ln -s "$ROOT/node_modules" "$TMP/wt/node_modules"
# fixtures and the visual suite come from the current tree so both sides render the same pages
rm -rf "$TMP/wt/preview-src/fixtures" "$TMP/wt/tests" "$TMP/wt/scripts"
cp -R "$ROOT/preview-src/fixtures" "$TMP/wt/preview-src/fixtures"
cp -R "$ROOT/tests" "$TMP/wt/tests"
cp -R "$ROOT/scripts" "$TMP/wt/scripts"
cp "$ROOT/playwright.config.js" "$TMP/wt/playwright.config.js"
(cd "$TMP/wt" && npx gulp preview:build && npx playwright test --update-snapshots)
rm -rf "$ROOT/tests/visual/__screenshots__"
cp -R "$TMP/wt/tests/visual/__screenshots__" "$ROOT/tests/visual/__screenshots__"
echo "Baselines for $REF written to tests/visual/__screenshots__/"
