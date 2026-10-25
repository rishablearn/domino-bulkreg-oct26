# SOP: Recover failed and missing users

Applies to BulkReg **4.6.0** (upgrade steps: `DEPLOY-4.6.0.md`).

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

## If it is slow, or Notes hangs after hours ("too many handles" in NSD)

**What the documentation says (and what it does not):**

- `CreateFromTemplate` **returns before a large copy has finished** ([HCL reference](https://help.hcl-software.com/dom_designer/11.0.1/basic/H_CREATEFROMTEMPLATE_METHOD.html)). A loop that does not wait lets several big copies pile up on the server, and sets title and ACL on half-copied files.
- There is **no documented LotusScript switch** to let AdminP create the mail file in the background; that exists only in the C API ([NotesRegistration properties](https://help.hcl-software.com/dom_designer/14.5.0/basic/H_NOTESREGISTRATION_CLASS.html)). So creating the file "like 03" (registration with `CreateMailDb`) is also client driven and is **not** expected to be faster. That is why 03 stays fast only with `MailFileDeferred=1`.
- A single Notes client process that runs for 8 hours holds every handle it opens. Not confirmed from the NSD: the cause. See "Confirm it" below.

**What agent 13 does about it:**

- Creates **one mail file at a time and waits until its copy is complete** (poll for the design every 2 s, `RecoverCreateWaitSec`), on the home server with the template opened on the same server. The three timings (`SecExists`, `SecCreate`, `SecAcl`) are in `RECOVER_<run>_timing.csv`.
- Works in **short sessions**: stops cleanly after **250 mail files** or **60 minutes** (`RecoverMaxCreates`, `RecoverMaxMinutes`), and tells you: *close Notes completely, open it again, run 13 again.* Restarting the client is what releases the handles. A run is never meant to last 8 hours.
- Releases every database and view object as soon as it is done, releases everything it keeps at library level (directory, template database, AdminP, log) before and after every run, and reads the mail-file lists from CSV instead of opening each file.
- Stops itself when the server is struggling (3 creates over 60 s in a row).

**Handle audit of the code (what was checked, what was found):** `.recycle()` is a Java rule; LotusScript frees a back-end object when its variable goes out of scope or is set to `Nothing`. So the places that can leak are library-level (global) object variables, objects created in a loop and kept, and unclosed files. Result for BulkRegCommon, BulkRegAgents and BulkRegRecover:

| Check | Finding |
|---|---|
| Global object variables | Six: `gSession` (one, kept), `gLogDb`, `gRunDoc`, `gAdminP`, `gTmplDb` (all set to `Nothing` when a run closes) and, in the new library, `gRecDb` (**was never released: fixed**, 13 now releases all of them before and after each run) |
| Objects created per user | Every one (`NotesRegistration`, `NotesDatabase` for mail checks, ACL, views, `NotesName`) is a local of a function that returns after each user, or a variable that is re-`Set` each pass. No object is stored in a list or array |
| Files | Every `Open` has a `Close`, also on the error path; `BR_AppendLine` opens and closes per line |
| Whole-run collections | The directory search collection is held for the whole run in the existing agents (one memory block, not a leak); 13 releases it after the scan |
| **Not found** | **No per-user leak in the existing agents 03 and 08 by reading the code.** I changed none of them. The reading cannot prove there is none: an 8-hour single process can still exhaust Notes' internal tables |

**Prove it with data:** run `scripts\windows\BulkReg_WatchNotes.ps1` before the session. It records the Notes client's handle count every 30 s and prints the change per hour. Handles rising steadily with every mail file = the client leaks, keep sessions short. Flat handles = the cause is elsewhere (send the NSD and the CSV to HCL support).

**For the agents already in use, no code change needed:** set `MailCreateMaxPerRun=250` (08) and `BatchSize=250` (02/03). Each run then ends by itself; close Notes, reopen, run again (03 and 08 resume). Create `STOP.txt` in `BatchDir` to end a run cleanly at any time.

**Confirm it (so we fix the right thing):**

1. Run one session of 13 and open `RECOVER_<run>_timing.csv`: is `SecCreate` high? Then the server copy is the slow part (busy server, antivirus scanning the mail folders, backup or indexer running).
2. Watch `nlnotes.exe` in Windows Task Manager (Handles, Memory) during a session. If handles climb steadily per mail file, send the NSD and `RECOVER_<run>_timing.csv` to HCL support with the Notes client version.
3. Server side, run the client next to the servers (same LAN or a VM beside them) and outside backup windows.

**If creating from the client is still too slow:** the next step is a small **server-side worker** (an agent on each mail server that creates the files locally and works through a list in short runs). It needs a database on each mail server, an agent signed by an ID allowed to run unrestricted agents and create databases there, and a decision by the Domino security owner. Tell me if you want it built; it is not part of this release.

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

### Handle watcher (Windows)

<!--include:scripts/windows/BulkReg_WatchNotes.ps1-->

### Git: Mac push

<!--include:scripts/mac/sync_to_github.sh-->

### Git: Windows pull

<!--include:scripts/windows/BulkReg_SyncFromGitHub.ps1-->
