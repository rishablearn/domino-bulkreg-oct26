# SOP: Recover failed and missing users

**One rule:** the Domino Directory is the truth. Agent **13 - Recover Users** compares it with the mail servers and fixes what is wrong in one run: it **removes duplicates, creates missing mail files, replaces cut-off ones, and frees the users that `02 - Build Batch` was silently skipping**. It does not matter which machine or which release (4.5 or older) registered a user. Run it again as often as you like: it only does what is still missing and never overwrites a mail file.

> Agent 13 is **not compiled or run against Domino yet**. Do the pilot (step 4) first.

## The five steps

| # | Do | Result |
|---|---|---|
| 1 | **On each mail server** run the listing script, copy the CSV to the BulkReg machine into `C:\BulkReg\maillists\` | Server file lists (read-only, 1 minute) |
| 2 | `DryRun=1`. Run **13 - Recover Users** | Counts on screen + `RECOVER_<run>_plan.csv` |
| 3 | Read the plan (`Include=Y` rows are fixed by 13; `MANUAL` rows need a person) | Plan agreed |
| 4 | **Pilot:** add `RecoverMaxCreates=10`, `DryRun=0`, run 13, type `RECOVER`. Check 2 or 3 users. Then remove `RecoverMaxCreates` and run 13 again | Duplicates removed, mail files created, stale batches closed. If it stops (slow server, time limit), run it again |
| 5 | Run **02 - Build Batch**, review, **03 - Register Batch** for the users still not registered. Run 13 once more (`DryRun=1`) | 13 says **nothing for this agent to do** |

Finish: hand over initial passwords from `secure\` and delete them. Set `DryRun=1`.

**Listing scripts** (they only list files; nothing is changed):

- Linux: `scripts/linux/bulkreg_list_mailfiles.sh /local/notesdata "DominoADMail/Demo"`
- Windows: `powershell -ExecutionPolicy Bypass -File BulkReg_ListMailFiles.ps1 -DataDir D:\Domino\Data -Server "DominoADMail2/Demo"`

No list for a server? 13 checks that server live. It works, but it is slower.

## What 13 does with each user

| Finding | Action |
|---|---|
| Unregistered full duplicate of a registered user (same name, short name, Internet address) | **Removed**, after a snapshot (up to `DuplicateMaxDelete`, default 25 per run). Mail files, ID files and the registered user are never touched |
| Registered, mail file missing | **Created** |
| Mail file is a tiny, cut-off file | **Replaced** (only with `RepairRemoveEmptyShells=1`, only in a BulkReg mail folder) |
| Not registered, held back by an old open or stopped batch (older than 24 h) | **Batch closed**, so 02 builds the user |
| Not registered, nothing holds it back | Counted as **ready for 02** |
| Anything else (no mail item, server down, file with data but no design, recent open batch, no Internet address, doubtful duplicate) | `MANUAL`: reason in the plan, you fix it |

**Why 02 "created nothing":** 02 skips every user who is in an open or stopped batch file on that machine, who is a duplicate of a registered user, or who has no Internet address. The plan shows which of these applies to each user, and 13 closes the stale batches. After that, 02 finds the rest.

## Two machines

Set once: Machine A `PartitionCount=2`, `PartitionIndex=1`. Machine B `PartitionCount=2`, `PartitionIndex=2`. Each handles its own half of the users.

1. Same kit and same `DirectoryServer` on both.
2. Dry run on both: **"Directory users scanned" must be the same number**. If not, wait for directory replication.
3. Run both at the same time. A second run on the same partition is refused (log-database guard); if a machine crashed, answer **Yes** to the warning only when that run is really over.

## If it is slow or hangs

13 writes `RECOVER_<run>_timing.csv` (seconds per create) and stops itself after 3 creates over 60 s in a row or 120 minutes: run it again later. Likely causes (not confirmed): busy server (backup, indexer), antivirus scanning the mail folders, client far from the server. Run the client next to the servers. After a hang just run 13 again: cut-off files are found by size and replaced.

## Stop and escalate

Create `STOP.txt` in `BatchDir` to stop cleanly. For a suspected security incident (unexpected certificates or IDs, a password or ID file outside its folder), do not fix it yourself: create `STOP.txt` and call the Domino or security owner.

## Install and roll back

Install the library `BulkRegRecover` (paste `lotusscript/BulkRegRecover.lss`) and the agent `BulkReg\13 - Recover Users` (`lotusscript/Agent13_Recover.lss`), re-sign, recompile. Re-paste `BulkRegCommon` once (two label lines). Roll back: delete the agent and the library.

## Git

Mac: `scripts/mac/sync_to_github.sh` (commit + push). Windows: `scripts\windows\BulkReg_SyncFromGitHub.ps1 -DryRun`, then without `-DryRun` (safe pull; lists the `.lss` files to paste into Designer).

## Appendix: all scripts and code (click to expand, copy)

### Listing script, Linux mail server

<!--include:scripts/linux/bulkreg_list_mailfiles.sh-->

### Listing script, Windows mail server

<!--include:scripts/windows/BulkReg_ListMailFiles.ps1-->

### Agent 13 (paste into the agent `BulkReg\13 - Recover Users`)

<!--include:lotusscript/Agent13_Recover.lss-->

### Library BulkRegRecover (paste into a new script library)

<!--include:lotusscript/BulkRegRecover.lss-->

### Git: Mac push

<!--include:scripts/mac/sync_to_github.sh-->

### Git: Windows pull

<!--include:scripts/windows/BulkReg_SyncFromGitHub.ps1-->
