#!/usr/bin/env bash
# sync_to_github.sh - send the changes in this kit to GitHub (macOS, also works on Linux)
#
# Usage (Terminal):
#   chmod +x scripts/mac/sync_to_github.sh        # once
#   scripts/mac/sync_to_github.sh                 # shows changes, asks, then commits and pushes
#   scripts/mac/sync_to_github.sh "my message"    # same, with your commit message
#   scripts/mac/sync_to_github.sh --dry-run       # only show what would happen, change nothing
#
# What it does, in order (it asks before step 5):
#   1. finds the repo (the folder above scripts/), checks the remote and branch
#   2. rebuilds the HTML docs if python3 + 'markdown' are available (optional)
#   3. REFUSES to continue if a secret-looking file would be committed (ID files, passwords, secure/, ids/, batches/)
#   4. shows the changed files
#   5. asks, then: git pull --rebase --autostash, git add -A, git commit, git push
# It never uses --force, never deletes branches, never touches files outside this repo.
# Authentication is whatever git already uses on this Mac (credential helper / SSH key / gh auth).
# Not run by its author on a Mac: try --dry-run first.
set -euo pipefail

DRY=0
MSG=""
for a in "$@"; do
  case "$a" in
    --dry-run|-n) DRY=1 ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    *) MSG="$a" ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
say() { printf '\n== %s\n' "$*"; }
die() { printf 'STOP: %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null || die "git is not installed (run: xcode-select --install)"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "$ROOT is not a git repository"
REMOTE="${BULKREG_REMOTE:-origin}"
git remote get-url "$REMOTE" >/dev/null 2>&1 || die "no git remote '$REMOTE'. Add it: git remote add origin https://github.com/<org-or-user>/<repo>.git"
BRANCH="$(git branch --show-current)"
[ -n "$BRANCH" ] || die "detached HEAD: check out a branch first (git switch main)"
LOCK="$(git rev-parse --git-dir)/index.lock"
if [ -f "$LOCK" ]; then
  if pgrep -x git >/dev/null 2>&1; then
    die "a git process is running, so $LOCK may be in use. Wait for it to finish, then run this again"
  fi
  printf 'Found %s and no git process is running: it is a leftover of an interrupted git command.\nDelete it? [y/N] ' "$LOCK"
  read -r lans
  case "$lans" in y|Y|yes|YES) rm -f "$LOCK"; echo "Removed $LOCK" ;; *) die "lock file kept. Delete it yourself (rm \"$LOCK\") and run again" ;; esac
fi

say "Repo   : $ROOT"
say "Remote : $REMOTE -> $(git remote get-url "$REMOTE")   Branch: $BRANCH"

# 2. optional: rebuild the HTML docs from the Markdown sources
if [ -f scripts/build_docs_html.py ] && command -v python3 >/dev/null && python3 -c 'import markdown' 2>/dev/null; then
  if [ "$DRY" -eq 0 ]; then say "Rebuilding HTML docs"; python3 scripts/build_docs_html.py | tail -3; else say "(dry run) would rebuild HTML docs"; fi
else
  say "HTML docs not rebuilt (python3 with 'markdown' not found: pip3 install markdown)"
fi

# 3. secret guard: look at everything that would be added (new, changed, deleted)
say "Checking for secrets"
BAD="$(git status --porcelain --untracked-files=all | sed 's/^...//' | grep -Ei '(\.id$|(^|/)(secure|ids|cert|batches|audit)/|InitialPasswords|_audit\.csv$|_debug\.log$|\.local\.(ini|csv)$|\.pem$|\.key$|\.p12$)' || true)"
if [ -n "$BAD" ]; then
  printf '%s\n' "$BAD" >&2
  die "the files above look like secrets or runtime data. Remove them from the repo folder (or add them to .gitignore). Nothing was committed."
fi
echo "OK: nothing secret-looking."

# 4. what changed
say "Changes"
if [ -z "$(git status --porcelain)" ]; then
  echo "No local changes."
  if [ "$DRY" -eq 1 ]; then exit 0; fi
else
  git status --short
  echo
  git diff --stat HEAD 2>/dev/null | tail -15 || true
fi
[ "$DRY" -eq 1 ] && { say "Dry run finished: nothing was changed."; exit 0; }

# 5. confirm, then sync
[ -n "$MSG" ] || MSG="Update BulkReg kit $(date '+%Y-%m-%d %H:%M')"
printf '\nCommit message: %s\nCommit and push to %s/%s ? [y/N] ' "$MSG" "$REMOTE" "$BRANCH"
read -r ans
case "$ans" in y|Y|yes|YES) ;; *) echo "Cancelled. Nothing was changed."; exit 0 ;; esac

say "Pulling remote changes first"
git pull --rebase --autostash "$REMOTE" "$BRANCH" || die "pull/rebase had a conflict. Resolve it (git status), then: git rebase --continue, and run this script again"

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "$MSG"
else
  echo "Nothing new to commit."
fi

say "Pushing"
git push "$REMOTE" "$BRANCH" || die "push failed. Check your GitHub login (gh auth login, or your credential helper / SSH key)"
say "Done: $(git rev-parse --short HEAD) is on $REMOTE/$BRANCH"
