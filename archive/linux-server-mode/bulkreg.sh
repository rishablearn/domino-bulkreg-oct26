#!/usr/bin/env bash
# =====================================================================
#  bulkreg.sh  -  BulkReg 1.1 admin tool for Linux / RHEL Domino servers
#
#  Prepares folders and permissions, validates the config, arms/disarms
#  headless runs, prints the Domino console commands, summarises audit
#  CSVs, follows logs and securely removes temporary secrets.
#
#  The registration itself runs INSIDE Domino (server agent in bulkreg.nsf).
#  This script never registers users and never touches names.nsf.
#
#  Usage:  ./bulkreg.sh <command> [options]      (./bulkreg.sh help)
#  Every state-changing command is written to <AuditDir>/bulkreg_admin_actions.log
# =====================================================================
set -euo pipefail

VERSION="1.1.0"
BASE="${BULKREG_BASE:-/local/bulkreg}"
CFG="${BULKREG_CONFIG:-$BASE/config/bulkreg.ini}"
DOMINO_USER="${DOMINO_USER:-notes}"          # OS account that runs the Domino server
DOMINO_GROUP="${DOMINO_GROUP:-notes}"
DB="${BULKREG_DB:-bulkreg.nsf}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIT_CONFIG_DIR="$SCRIPT_DIR/../../config"

declare -A AGENTS=(
  [01]="01 | Preflight Check"
  [02]="02 | Export to Registration Text File"
  [03]="03 | Bulk Register (ID Vault)"
  [04]="04 | Verify Registration + Vault"
)

c_red=$'\e[31m'; c_grn=$'\e[32m'; c_yel=$'\e[33m'; c_off=$'\e[0m'
[[ -t 1 ]] || { c_red=""; c_grn=""; c_yel=""; c_off=""; }
ok()   { echo "${c_grn}PASS${c_off}  $*"; }
bad()  { echo "${c_red}FAIL${c_off}  $*"; FAILS=$((FAILS+1)); }
wrn()  { echo "${c_yel}WARN${c_off}  $*"; WARNS=$((WARNS+1)); }
die()  { echo "${c_red}ERROR:${c_off} $*" >&2; exit 1; }
FAILS=0; WARNS=0

# ---------- config helpers ----------
cfg_get() {   # cfg_get KEY [default]   (case-insensitive key, first match)
  local v
  v=$(awk -F= -v k="$(echo "$1" | tr '[:upper:]' '[:lower:]')" '
      /^[[:space:]]*[#;\[]/ {next}
      { key=$1; gsub(/^[ \t]+|[ \t]+$/,"",key)
        if (tolower(key)==k) { sub(/^[^=]*=/,""); gsub(/^[ \t]+|[ \t\r]+$/,""); print; exit } }' "$CFG" 2>/dev/null || true)
  echo "${v:-${2:-}}"
}
cfg_dir() { local d; d=$(cfg_get "$1" "$BASE/$2"); d="${d//\\//}"; echo "${d%/}"; }

cfg_set() {   # cfg_set KEY VALUE  - edits in place, keeps a timestamped backup, shows the diff
  local key="$1" val="$2" bak
  [[ -f "$CFG" ]] || die "config not found: $CFG"
  bak="$CFG.bak.$(date +%Y%m%d-%H%M%S)"
  cp -p "$CFG" "$bak"
  if grep -qiE "^[[:space:]]*$key[[:space:]]*=" "$CFG"; then
    sed -i -E "s|^[[:space:]]*($key)[[:space:]]*=.*|\1=$val|I" "$CFG"
  else
    printf '%s=%s\n' "$key" "$val" >> "$CFG"
  fi
  echo "Changed $CFG (backup: $bak):"
  diff -u "$bak" "$CFG" || true
  log_action "cfg_set $key=$val"
}

log_action() {
  local a; a="$(cfg_dir AuditDir audit)"
  [[ -d "$a" && -w "$a" ]] || return 0
  printf '%s\t%s\t%s\t%s\n' "$(date '+%F %T')" "$(id -un)" "$(hostname)" "$*" >> "$a/bulkreg_admin_actions.log"
}

latest() { ls -1t "$(cfg_dir AuditDir audit)"/$1 2>/dev/null | head -n1 || true; }

# ---------- commands ----------
cmd_help() {
cat <<EOF
bulkreg.sh $VERSION  - BulkReg admin tool for Linux / RHEL
Environment: BULKREG_BASE=$BASE  BULKREG_CONFIG=$CFG  DOMINO_USER=$DOMINO_USER

  init                 Create $BASE/{config,ids,secure,audit,cert}, set owner/permissions,
                       install config templates if missing (needs root/sudo)
  check                Validate folders, permissions, config values and Linux prerequisites
  console              Print the Domino console commands for this config
  run <01|02|03|04>    Print (or, if BULKREG_CONSOLE_CMD is set, send) 'tell amgr run'
  arm | disarm         Set ServerRunEnabled=1 / 0 (kill switch for headless runs)
  confirm-today        Set ServerConfirm=REGISTER-<today> (required for a LIVE headless run)
  dryrun on|off        Set DryRun=1 / 0
  status [audit.csv]   Summarise an audit CSV by Result (default: newest)
  tail                 Follow the newest debug log
  purge-secrets [--include-ids] [--yes]
                       List (default) or securely delete initial-password files,
                       registration text files and optionally local ID files
EOF
}

cmd_init() {
  [[ $EUID -eq 0 ]] || die "init must run as root (sudo) to set ownership"
  id "$DOMINO_USER" >/dev/null 2>&1 || die "OS user '$DOMINO_USER' not found (set DOMINO_USER=<domino service account>)"
  for d in config ids secure audit cert; do mkdir -p "$BASE/$d"; done
  chown -R "$DOMINO_USER:$DOMINO_GROUP" "$BASE"
  chmod 750 "$BASE" "$BASE/config" "$BASE/audit"
  chmod 700 "$BASE/ids" "$BASE/secure" "$BASE/cert"
  if [[ ! -f "$BASE/config/bulkreg.ini" && -f "$KIT_CONFIG_DIR/bulkreg.linux.ini" ]]; then
    install -o "$DOMINO_USER" -g "$DOMINO_GROUP" -m 640 "$KIT_CONFIG_DIR/bulkreg.linux.ini" "$BASE/config/bulkreg.ini"
    echo "Installed config template -> $BASE/config/bulkreg.ini"
  fi
  if [[ ! -f "$BASE/config/server_mapping.csv" && -f "$KIT_CONFIG_DIR/server_mapping.csv" ]]; then
    install -o "$DOMINO_USER" -g "$DOMINO_GROUP" -m 640 "$KIT_CONFIG_DIR/server_mapping.csv" "$BASE/config/server_mapping.csv"
    echo "Installed mapping template -> $BASE/config/server_mapping.csv"
  fi
  # strip Windows CR line ends if the templates were copied from Windows
  sed -i 's/\r$//' "$BASE"/config/*.ini "$BASE"/config/*.csv 2>/dev/null || true
  if command -v getenforce >/dev/null 2>&1 && [[ "$(getenforce)" == "Enforcing" ]]; then
    echo "${c_yel}SELinux is Enforcing.${c_off} If Domino runs confined, label $BASE so the server can write to it"
    echo "  (check with: ls -Z $BASE ; ausearch -m avc -ts recent)."
  fi
  ls -ld "$BASE" "$BASE"/*
  CFG="$BASE/config/bulkreg.ini"; log_action "init base=$BASE owner=$DOMINO_USER"
  echo "Next: edit $BASE/config/bulkreg.ini, then: $0 check"
}

perm_check() {   # perm_check DIR EXPECTED_MODE
  local d="$1" m="$2" cur own
  [[ -d "$d" ]] || { bad "missing folder $d"; return; }
  cur=$(stat -c %a "$d"); own=$(stat -c %U "$d")
  [[ "$own" == "$DOMINO_USER" ]] && ok "$d owner $own" || bad "$d owner is $own, expected $DOMINO_USER"
  [[ "$cur" == "$m" ]] && ok "$d mode $cur" || wrn "$d mode $cur, expected $m"
}

cmd_check() {
  echo "== Files and permissions"
  [[ -f "$CFG" ]] && ok "config $CFG" || { bad "config $CFG not found"; summary; return; }
  grep -q $'\r' "$CFG" && wrn "config has Windows CRLF line ends (run: sed -i 's/\\r\$//' $CFG)" || ok "config line ends (LF)"
  perm_check "$(cfg_dir IDFileDir ids)" 700
  perm_check "$(cfg_dir PasswordDir secure)" 700
  perm_check "$(cfg_dir AuditDir audit)" 750
  local map; map=$(cfg_get MappingFile "$BASE/config/server_mapping.csv")
  [[ -f "$map" ]] && ok "mapping $map" || bad "mapping file $map not found"

  echo "== Config values"
  grep -nE '<[A-Za-z0-9/ =._-]+>' "$CFG" | grep -v '^[0-9]*:[[:space:]]*#' >/dev/null \
    && bad "unreplaced <PLACEHOLDER> values: $(grep -nE '<[^>]+>' "$CFG" | grep -v ':[[:space:]]*#' | cut -d: -f1 | tr '\n' ' ')" \
    || ok "no <PLACEHOLDER> values left"
  [[ "$(cfg_get UseCA 1)" == "1" ]] && ok "UseCA=1 (required for server mode)" || bad "UseCA must be 1 on a Linux server (no certifier password prompt possible)"
  grep -qE '[A-Za-z]:\\' "$CFG" && wrn "Windows drive paths found in config - use Linux paths on this server" || ok "no Windows drive paths"
  [[ "$(cfg_get DryRun 1)" == "1" ]] && ok "DryRun=1 (safe)" || wrn "DryRun=0 - LIVE mode"
  [[ "$(cfg_get ServerRunEnabled 0)" == "1" ]] && wrn "ServerRunEnabled=1 (armed)" || ok "ServerRunEnabled=0 (disarmed)"
  local tok; tok=$(cfg_get ServerConfirm)
  if [[ -n "$tok" && "$tok" != "REGISTER-$(date +%Y%m%d)" ]]; then wrn "ServerConfirm=$tok is not today's token (LIVE will be refused - as intended)"; fi
  [[ -n "$(cfg_get DefaultPolicy)" ]] && ok "DefaultPolicy set" || wrn "DefaultPolicy empty"
  [[ -n "$(cfg_get VaultServer)" ]] && ok "VaultServer set" || wrn "VaultServer empty - no vault verification"

  echo "== Linux prerequisites"
  id "$DOMINO_USER" >/dev/null 2>&1 && ok "OS user $DOMINO_USER exists" || bad "OS user $DOMINO_USER missing"
  pgrep -u "$DOMINO_USER" -x server >/dev/null 2>&1 && ok "Domino server process running as $DOMINO_USER" || wrn "no Domino 'server' process found for $DOMINO_USER"
  command -v python3 >/dev/null 2>&1 && ok "python3 available (status command)" || wrn "python3 missing - status falls back to awk"
  if command -v timedatectl >/dev/null 2>&1; then ok "server time zone: $(timedatectl show -p Timezone --value 2>/dev/null || echo unknown) (ServerConfirm uses the server date)"; fi
  summary
}
summary() { echo; echo "Result: $FAILS fail(s), $WARNS warning(s)"; [[ $FAILS -eq 0 ]]; }

cmd_console() {
  echo "# Run these on the Domino server console (or Domino Administrator > Server > Console):"
  echo "set config BulkRegConfigPath=$CFG"
  for k in 01 02 03 04; do echo "tell amgr run \"$DB\" '${AGENTS[$k]}'"; done
}

cmd_run() {
  local k="${1:-}"; [[ -n "${AGENTS[$k]:-}" ]] || die "usage: run 01|02|03|04"
  local c="tell amgr run \"$DB\" '${AGENTS[$k]}'"
  [[ "$(cfg_get ServerRunEnabled 0)" == "1" ]] || wrn "ServerRunEnabled=0 - the agent will refuse to run (use: $0 arm)"
  if [[ "$k" == "03" && "$(cfg_get DryRun 1)" == "0" && "$(cfg_get ServerConfirm)" != "REGISTER-$(date +%Y%m%d)" ]]; then
    wrn "LIVE run without today's ServerConfirm token - Agent 03 will refuse (use: $0 confirm-today)"
  fi
  log_action "run $k"
  if [[ -n "${BULKREG_CONSOLE_CMD:-}" ]]; then
    echo "Sending via BULKREG_CONSOLE_CMD: $c"
    # shellcheck disable=SC2086
    $BULKREG_CONSOLE_CMD "$c"
  else
    echo "Enter on the Domino console:"; echo "  $c"
    echo "(Optional automation: export BULKREG_CONSOLE_CMD='<your console wrapper>' - verify it on your Domino build first.)"
  fi
  echo "Follow progress: $0 tail"
}

cmd_status() {
  local f="${1:-$(latest '*_audit.csv')}"
  [[ -n "$f" && -f "$f" ]] || die "no audit CSV found"
  echo "Audit file: $f"
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$f" <<'PY'
import csv, sys, collections
rows = list(csv.DictReader(open(sys.argv[1], encoding="utf-8-sig", newline="")))
if not rows: print("(empty)"); sys.exit()
r0 = rows[0]
print(f"Run {r0['RunID']}  tool={r0['Tool']}  mode={r0['Mode']}  operator={r0['Operator']}  rows={len(rows)}")
c = collections.Counter(r["Result"] for r in rows)
for k, v in c.most_common(): print(f"  {k:<28}{v:>7}")
bad = [r for r in rows if r["Result"].startswith(("FAIL", "ERROR", "CHECK_ERROR")) or "PENDING" in r["Result"]]
if bad:
    print("\nNeeds attention (first 15):")
    for r in bad[:15]: print(f"  {r['Result']:<26} {r['FullNameBefore'][:30]:<30} {r['Message'][:90]}")
PY
  else
    gawk -v FPAT='([^,]*)|("[^"]*")' 'NR>1 {gsub(/"/,"",$7); n[$7]++} END {for (k in n) printf "  %-28s%7d\n", k, n[k]}' "$f"
  fi
}

cmd_tail() { local f; f=$(latest '*_debug.log'); [[ -n "$f" ]] || die "no debug log yet"; echo "Following $f"; tail -n 50 -F "$f"; }

cmd_purge() {
  local yes=0 ids=0 a sec idd files=()
  for a in "$@"; do case "$a" in --yes) yes=1;; --include-ids) ids=1;; *) die "unknown option $a";; esac; done
  sec=$(cfg_dir PasswordDir secure); idd=$(cfg_dir IDFileDir ids)
  while IFS= read -r -d '' f; do files+=("$f"); done < <(find "$sec" -maxdepth 1 -type f \( -name 'BulkReg_InitialPasswords_*.csv' -o -name 'BatchReg_DirSync_*.txt' \) -print0 2>/dev/null)
  if [[ $ids -eq 1 ]]; then while IFS= read -r -d '' f; do files+=("$f"); done < <(find "$idd" -maxdepth 1 -type f -name '*.id' -print0 2>/dev/null); fi
  [[ ${#files[@]} -gt 0 ]] || { echo "Nothing to purge."; return; }
  printf 'Will remove (%d):\n' "${#files[@]}"; printf '  %s\n' "${files[@]}"
  [[ $ids -eq 1 ]] && echo "${c_yel}Only remove ID files after Agent 04 shows IN_VAULT for every user.${c_off}"
  [[ $yes -eq 1 ]] || { echo "Dry run. Re-run with --yes to delete."; return; }
  for f in "${files[@]}"; do
    if command -v shred >/dev/null 2>&1; then shred -u -z "$f"; else rm -f "$f"; fi
    log_action "purge $f"
  done
  echo "Removed ${#files[@]} file(s)."
}

case "${1:-help}" in
  help|-h|--help) cmd_help ;;
  init)           cmd_init ;;
  check)          cmd_check ;;
  console)        cmd_console ;;
  run)            shift; cmd_run "${1:-}" ;;
  arm)            cfg_set ServerRunEnabled 1 ;;
  disarm)         cfg_set ServerRunEnabled 0 ;;
  confirm-today)  cfg_set ServerConfirm "REGISTER-$(date +%Y%m%d)" ;;
  dryrun)         case "${2:-}" in on) cfg_set DryRun 1;; off) cfg_set DryRun 0;; *) die "usage: dryrun on|off";; esac ;;
  status)         shift; cmd_status "${1:-}" ;;
  tail)           cmd_tail ;;
  purge-secrets)  shift; cmd_purge "$@" ;;
  *)              cmd_help; exit 1 ;;
esac
