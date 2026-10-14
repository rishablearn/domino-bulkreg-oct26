#!/usr/bin/env bash
# =====================================================================
#  autosync_ctl.sh - BulkReg 4.0.1 helper for the AutoSync state folder (Linux Domino server)
#
#  It only reads and writes the small state files of AutoSync (AutoStateDir).
#  It never touches Domino, names.nsf or any ID file.
#
#    status                 state, STOP file, lock, held-back users, users still being verified
#    pause [reason]         create the STOP file (the next run halts and reports)
#    resume                 delete the STOP file
#    release <objectGUID>   remove one user from the quarantine list (he is retried by the next run)
#    release-all            empty the quarantine list (every held-back user is retried)
#
#  Usage:   AUTOSYNC_STATE=/local/notesdata/bulkreg/state ./autosync_ctl.sh status
#  Run as the Domino service account (or as root with the same file rights).
#  Every state-changing command is appended to <state>/autosync_ctl.log
# =====================================================================
set -euo pipefail

STATE="${AUTOSYNC_STATE:-/local/notesdata/bulkreg/state}"
QFILE="$STATE/autosync_quarantine.csv"
PFILE="$STATE/autosync_pending.csv"
SFILE="$STATE/autosync_state.txt"

die() { echo "ERROR: $*" >&2; exit 1; }
[ -d "$STATE" ] || die "state folder not found: $STATE (set AUTOSYNC_STATE)"

log_action() { printf '%s\t%s\t%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${SUDO_USER:-$USER}" "$*" >> "$STATE/autosync_ctl.log"; }

count_rows() { [ -f "$1" ] && [ "$(wc -l < "$1")" -gt 1 ] && echo $(( $(wc -l < "$1") - 1 )) || echo 0; }

cmd="${1:-help}"
case "$cmd" in
  status)
    echo "State folder : $STATE"
    if [ -f "$STATE/STOP" ]; then echo "STOP file    : PRESENT - $(head -n1 "$STATE/STOP")"; else echo "STOP file    : none"; fi
    if [ -f "$STATE/autosync.lock" ]; then echo "Lock         : $(head -n1 "$STATE/autosync.lock")"; else echo "Lock         : none (no run active)"; fi
    if [ -f "$SFILE" ]; then echo "--- autosync_state.txt"; cat "$SFILE"; else echo "autosync_state.txt: not written yet"; fi
    echo "--- held back (quarantine file lines, incl. entries whose NextTry has passed): $(count_rows "$QFILE")"
    [ -f "$QFILE" ] && tail -n +2 "$QFILE" | head -n 20 | cut -c1-200 || true
    echo "--- still being verified: $(count_rows "$PFILE")"
    [ -f "$PFILE" ] && tail -n +2 "$PFILE" | head -n 20 | cut -c1-200 || true
    ;;
  pause)
    shift || true
    reason="${*:-paused by $USER}"
    printf 'Paused by %s at %s: %s\r\nDelete this file to resume.\r\n' "${SUDO_USER:-$USER}" "$(date '+%Y-%m-%d %H:%M:%S')" "$reason" > "$STATE/STOP"
    log_action "pause: $reason"
    echo "STOP file written. The next run halts and mails an ALERT once."
    ;;
  resume)
    [ -f "$STATE/STOP" ] || die "no STOP file"
    rm -f "$STATE/STOP"
    log_action "resume"
    echo "STOP file removed. The next scheduled run resumes."
    ;;
  release)
    guid="${2:-}"; [ -n "$guid" ] || die "usage: release <objectGUID>"
    [ -f "$QFILE" ] || die "no quarantine file"
    case "$guid" in *[!0-9a-zA-Z{}-]*) die "objectGUID contains unexpected characters";; esac
    tmp="$QFILE.tmp.$$"
    # keep the header and every line that does not start with the quoted GUID (case-insensitive)
    awk -v g="$(printf '%s' "$guid" | tr 'A-Z' 'a-z')" 'NR==1{print;next} { l=tolower($0); if (index(l, "\"" g "\"")!=1 && index(l, "\xef\xbb\xbf\"" g "\"")!=1) print }' "$QFILE" > "$tmp"
    before=$(count_rows "$QFILE"); after=$(count_rows "$tmp")
    [ "$before" -ne "$after" ] || { rm -f "$tmp"; die "objectGUID not found in $QFILE"; }
    mv "$tmp" "$QFILE"
    log_action "release $guid"
    echo "Released ($before -> $after lines). The next run offers the user again."
    ;;
  release-all)
    [ -f "$QFILE" ] || die "no quarantine file"
    cp "$QFILE" "$QFILE.bak.$(date +%Y%m%d-%H%M%S)"
    head -n1 "$QFILE" > "$QFILE.tmp.$$" && mv "$QFILE.tmp.$$" "$QFILE"
    log_action "release-all (backup kept)"
    echo "Quarantine list emptied (backup kept next to it)."
    ;;
  *)
    sed -n '2,19p' "$0"
    ;;
esac
