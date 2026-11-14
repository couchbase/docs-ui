#!/bin/sh
# Generate visual-regression baselines from a base ref (default: origin/master) without touching your working
# tree: checks the ref out into a temporary git worktree, builds its preview, and writes the screenshots into this
# repo's tests/visual/__screenshots__/ (replacing any existing ones). Then run `npm run test:visual` on your branch.
#
# The ref supplies src/ (CSS, templates, JS) and preview-src/; the build tooling, fixtures, tests and node_modules
# come from the current tree. That way the ref renders with the same tooling as your branch, even if the ref's own
# build would need different dependencies than are installed.
set -eu
REF="${1:-origin/master}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'git -C "$ROOT" worktree remove --force "$TMP/wt" >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
git -C "$ROOT" worktree add --detach "$TMP/wt" "$REF"
ln -s "$ROOT/node_modules" "$TMP/wt/node_modules"
for p in gulp.d gulpfile.js scripts tests playwright.config.js package.json; do
  rm -rf "$TMP/wt/$p"
  cp -R "$ROOT/$p" "$TMP/wt/$p"
done
rm -rf "$TMP/wt/preview-src/fixtures"
cp -R "$ROOT/preview-src/fixtures" "$TMP/wt/preview-src/fixtures"
(cd "$TMP/wt" && node scripts/visual-test.js --update-snapshots)
rm -rf "$ROOT/tests/visual/__screenshots__"
cp -R "$TMP/wt/tests/visual/__screenshots__" "$ROOT/tests/visual/__screenshots__"
echo "Baselines for $REF written to tests/visual/__screenshots__/"
