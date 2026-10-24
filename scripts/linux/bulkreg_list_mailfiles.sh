#!/usr/bin/env bash
# bulkreg_list_mailfiles.sh - list the mail files of THIS Domino server for BulkReg agent 13 - Recover Users
#
# Run on each Linux mail server (read-only; it only lists files):
#   ./bulkreg_list_mailfiles.sh <data directory> <server name as in Domino> [output.csv]
#   ./bulkreg_list_mailfiles.sh /local/notesdata "DominoADMail/Demo"
# Output CSV (UTF-8):  Server,Path,Bytes,Modified     Path is relative to the data directory (mail1/smith.nsf)
# Then copy the CSV to the machine that runs BulkReg, into its MailListDir (default C:\BulkReg\maillists\).
# Covers the folder "mail" and "mail<number>" (mail1, mail2 ...). Other folders: set FOLDERS="mail mail1 mail2 hr".
# Not a replacement for Domino's own view of the files: it lists what is on disk. A file that is copied or
# half-written right now may show a small size; agent 13 opens small files to check them.
set -euo pipefail
DATA="${1:-}"; SERVER="${2:-}"; OUT="${3:-}"
[ -d "$DATA" ] && [ -n "$SERVER" ] || { echo "Usage: $0 <data directory> <server name> [output.csv]" >&2; exit 1; }
[ -n "$OUT" ] || OUT="maillist_$(printf '%s' "$SERVER" | tr '/ ' '--')_$(date +%Y%m%d-%H%M%S).csv"
DATA="${DATA%/}"
{
  printf 'Server,Path,Bytes,Modified\n'
  if [ -n "${FOLDERS:-}" ]; then
    for f in $FOLDERS; do [ -d "$DATA/$f" ] && find "$DATA/$f" -maxdepth 1 -type f -iname '*.nsf' -printf '%P\t%s\t%TY-%Tm-%Td %TH:%TM\n' | sed "s|^|$f/|"; done
  else
    find "$DATA" -mindepth 2 -maxdepth 2 -type f -iname '*.nsf' \( -path "$DATA/mail/*" -o -path "$DATA/mail[0-9]*/*" \) -printf '%P\t%s\t%TY-%Tm-%Td %TH:%TM\n'
  fi | awk -F'\t' -v s="$SERVER" '{ gsub(/"/,"\"\"",$1); printf "\"%s\",\"%s\",%s,\"%s\"\n", s, $1, $2, $3 }'
} > "$OUT"
echo "Wrote $OUT ($(($(wc -l < "$OUT") - 1)) mail files)"
