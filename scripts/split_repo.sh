#!/usr/bin/env bash
# =====================================================================
#  split_repo.sh - keep everything committed so far in the OLD repo and
#  build a NEW repo that contains the same baseline plus the new changes.
#
#  OLD repo (this folder): untouched except one tag marking its last state.
#  NEW repo (sibling folder): 2 commits
#     1. "Baseline" = exact tree of OLD HEAD (what was committed so far)
#     2. "New changes" = everything uncommitted now (AutoSync 4.0.0 ...)
#  so `git show HEAD` in the new repo is precisely "all new changes".
#
#  Usage:  scripts/split_repo.sh <NEW_REPO_DIR> [dry-run]
#  It never pushes. It refuses to overwrite an existing NEW_REPO_DIR.
#  Secrets: .gitignore of the old repo is carried over; *.id, ids/, secure/,
#  audit/, batches/ and password CSVs are never copied into the new repo.
# =====================================================================
set -euo pipefail

NEW="${1:-}"; MODE="${2:-}"
[ -n "$NEW" ] || { echo "usage: $0 <NEW_REPO_DIR> [dry-run]" >&2; exit 1; }
OLD="$(cd "$(dirname "$0")/.." && pwd)"
[ -d "$OLD/.git" ] || { echo "ERROR: $OLD is not a git repo" >&2; exit 1; }
[ ! -e "$NEW" ] || { echo "ERROR: $NEW already exists (refusing to overwrite)" >&2; exit 1; }
case "$(cd "$(dirname "$NEW")" && pwd)/$(basename "$NEW")" in "$OLD"/*) echo "ERROR: NEW must be outside the old repo" >&2; exit 1;; esac

# commit identity: the old repo's / global git identity (a fresh repo has no local config)
GN="$(git -C "$OLD" config user.name || true)"; GE="$(git -C "$OLD" config user.email || true)"
[ -n "$GN" ] && [ -n "$GE" ] || { echo "ERROR: set git user.name and user.email first (git config --global ...)" >&2; exit 1; }
git_new() { git -C "$NEW" -c user.name="$GN" -c user.email="$GE" "$@"; }

VER="$(tr -d '\r\n ' < "$OLD/VERSION")"
BASE_REF="$(git -C "$OLD" rev-parse --short HEAD)"
BASE_TAG="archive-before-${VER}"

echo "Old repo      : $OLD  (HEAD $BASE_REF)"
echo "New repo      : $NEW"
echo "New version   : $VER"
echo "Uncommitted   : $(git -C "$OLD" status --short | wc -l | tr -d ' ') path(s) become the 'new changes' commit"
git -C "$OLD" status --short
[ "$MODE" = "dry-run" ] && { echo "dry-run: nothing written."; exit 0; }

# 1. mark the old repo's final state (a tag only; no file changes)
git -C "$OLD" tag -f "$BASE_TAG" HEAD >/dev/null
echo "Tagged old repo: $BASE_TAG"

# 2. baseline = exact tree of old HEAD
mkdir -p "$NEW"
git -C "$OLD" archive HEAD | tar -x -C "$NEW"
git -C "$NEW" init -q -b main
git -C "$NEW" add -A
git_new commit -q -m "Baseline: import of previous repo state ($BASE_REF)" \
  -m "Full history up to this point stays in the old repository (tag $BASE_TAG)."

# 3. overlay the working tree (committed + uncommitted), excluding .git and secrets
( cd "$OLD" && tar --exclude='./.git' --exclude='*.id' --exclude='./ids' --exclude='./secure' \
      --exclude='./audit' --exclude='./batches' --exclude='BulkReg_InitialPasswords_*.csv' -cf - . ) | tar -x -C "$NEW"
# remove files deleted in the working tree
git -C "$OLD" ls-files --deleted | while IFS= read -r f; do rm -f "$NEW/$f"; done

git -C "$NEW" add -A
if git -C "$NEW" diff --cached --quiet; then
  echo "No new changes to commit."
else
  git_new commit -q -m "BulkReg ${VER}: new changes since baseline" \
    -m "See CHANGELOG.md and docs/AUTOSYNC.md."
fi
git_new tag "v${VER}"

echo; git -C "$NEW" log --oneline; echo; git -C "$NEW" show --stat --oneline HEAD | tail -n 30
cat <<EOF

Next (manual, nothing was pushed):
  1. Create an EMPTY private repo on GitHub for the new project.
  2. cd "$NEW"
     git remote add origin https://github.com/<OWNER>/<NEW_REPO_NAME>.git
     git push -u origin main --tags
  3. Old repo: git -C "$OLD" push origin --tags   # publishes the $BASE_TAG marker
     Then optionally archive the old repo on GitHub (Settings > Archive).
EOF
