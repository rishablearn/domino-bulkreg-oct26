# BulkReg 4.5.0 – Post-deploy playbook (2 or more machines)

Covers: what data to collect and how to copy it, upgrading both machines to the same code, cleaning up what the previous version (run from two Notes clients on two machines) left behind, switching on the multi-machine safety of 4.5.0, running in parallel, and handling duplicates, aborted batches and users registered without a mail file.

> **Status:** the code is reviewed and checked for block balance, but **not compiled or run against Domino**. The two PowerShell helpers were written without a PowerShell available to run them. Keep `DryRun=1` until each step has been read, run the helpers first against a copy, and treat section 6 (pilot) as the acceptance test.
> All agents run from `bulkreg.nsf > Actions > BulkReg` in the Windows Domino Administrator client. `A` and `B` are your two machines. `<KIT>` is the folder holding the 4.5.0 kit (`lotusscript\`, `config\`, `scripts\`). Angle brackets are placeholders you replace.

## 0. How parallel running works in 4.5.0

| Item | Shared or per machine | Consequence |
|---|---|---|
| Domino Directory, mail servers, ID vault, log database | **Shared** | Source of truth. 09 reads the directory, so it sees both machines' work; 04, 11 and `RECOVER` check each row of a *local* batch file against the directory. |
| `BatchDir`, `AuditDir`, `PasswordDir`, `IDFileDir`, `ReconcileDir` (default `C:\BulkReg\...`) | **Per machine** | Batch files, results, flags, `STOP.txt`, ID files and initial passwords of a batch exist **only on the machine that ran it**. |
| Users | **Split by partition** | `PartitionCount=2`: every user belongs to exactly one machine (hash of the Person UNID). Machine A never builds, registers or repairs machine B's users, and vice versa. No shared folder needed. |

What the partition changes (and does not):

- **01 / 02** plan and build only this machine's users. **03** refuses a batch containing users of the other partition (error 6009). **08** repairs only this machine's users, so both machines can use the same scope or the same `RECON_*_gaps.csv`.
- **04, 09, 10, 11** are not partitioned. 09 covers the whole directory; 04 and 11 cover the batch files of the machine they run on.
- Batch IDs carry the machine tag: `BATCH-<run>-A-01.csv`. Run IDs are unchanged.
- **Known limit:** `HomeServerMaxUsers` capacity counts registered users plus the open batches of *this* machine only. Register every batch promptly after building it, or keep `BatchSize x machines` below the free capacity. Preflight prints a WARN about this when partitioning is on.

## 1. Data inventory: what you need from each machine

Collect this **from every machine that ever ran BulkReg** (both A and B). Paths are the defaults; the real folders are the `BatchDir`, `AuditDir`, `PasswordDir`, `IDFileDir`, `ReconcileDir` values in that machine's `bulkreg.ini`.

| # | What | Default location / file name | Needed for | Personal data or secret? | How it is handled |
|---|---|---|---|---|---|
| 1 | `bulkreg.ini` | `C:\BulkReg\config\bulkreg.ini` | Settings must match on both machines (servers, mail folders, naming, vault, log db) | No secrets by design; internal server names | Copied into the pack |
| 2 | `server_mapping.csv` | `C:\BulkReg\config\` | Same home-server rules on both | No | Copied into the pack |
| 3 | Batch files | `BatchDir\BATCH-<run>[-<tag>]-NN.csv` | Which users each machine put into batches (overlap check, `RECOVER`, resume) | **Yes**: names, e-mail addresses | Stay on the machine; only **redacted rows** (Include, UNID, NoteID, HomeServer, Check) go into the pack |
| 4 | Results files | `BatchDir\<batch>_results.csv` | Who was really registered by which machine | **Yes** | Redacted rows only (Timestamp, Action, Result, NoteID, UNID, HomeServer) |
| 5 | In-progress flags, `STOP.txt` | `BatchDir\<batch>_inprogress.flag`, `STOP.txt` | Shows stopped or hung runs | No | Listing in the pack; files copied only with `-Full` |
| 6 | Reports of 03/04/08/11 | `BatchDir\<batch>_dryrun_*.csv`, `_verify_*.csv`, `*_mailrepair_*.csv`, `RECOVER_*.csv`, `BATCHSTATUS_*.csv` | History of what was tried | **Yes** | Listing; copied only with `-Full` |
| 7 | Reconcile reports | `ReconcileDir\RECON_<run>_*.csv` | Gaps and duplicates seen so far | **Yes** | Listing; copied only with `-Full` |
| 8 | Audit run folders | `AuditDir\<date>_<agent>_<mode>\` : `RUN_INFO.txt`, `*_audit.csv`, `*_debug.log` | Who ran what, when, in which mode | `*_audit.csv` and debug logs **yes** (names); `RUN_INFO.txt` no | Listing; `RUN_INFO.txt` with `-Full`; `*_audit.csv` only with `-Full -IncludeAudit`. **Debug logs are never collected.** |
| 9 | **Initial-password files** | `PasswordDir\BulkReg_InitialPasswords_<batch>_<run>.csv` | Know which batches have passwords on which machine | **SECRET** | **Never copied or opened.** Listing with name, size, date and SHA256 only. Hand over and delete through your normal process |
| 10 | **User ID files** | `IDFileDir\<shortname>_<NoteID>.id` (and `_<run>` copies) | Duplicate check (which users already have an ID on which machine) | **SECRET**; file names contain short names | **Never copied.** Listing with SHA256 only, in the full pack, not in the redacted data |
| 11 | Kit files | `<KIT>\lotusscript\*.lss` | Both machines must run identical code | No | SHA256 per file (`-KitDir`) |
| 12 | Facts only you know | – | Context | – | Write them in `machine_info.txt`: Notes client version, who ran what on which date, any ID file moved or deleted by hand, any manual change in the directory |

Rules that apply to everything above:

- Treat the pack as **confidential company data**. Keep it on approved internal storage with restricted access; do not email it, paste it into chat tools, or upload it to external services. The default pack contains no names, e-mail addresses, passwords or ID files, but UNID/NoteID are internal Domino identifiers.
- **Never copy** `secure\` or `ids\` anywhere. If a password or ID file may have been exposed, rotate it and tell the security owner.
- Dry-run files and debug logs are noise for this exercise; do not copy them unless a specific question needs them.

## 2. How to copy things, step by step

Run all PowerShell in a normal (non-elevated) window. If your company policy blocks local scripts, ask IT or security how scripts are approved; do not weaken the policy. If the files came from a download, `Unblock-File '<path>'` removes the web mark.

### 2.1 Get the same kit onto machine B

On the machine that has the 4.5.0 kit (A):

```powershell
New-Item -ItemType Directory -Force 'C:\BulkReg\transfer' | Out-Null
Compress-Archive -Path '<KIT>\*' -DestinationPath 'C:\BulkReg\transfer\bulkreg-kit-4.5.0.zip' -Force
Get-FileHash 'C:\BulkReg\transfer\bulkreg-kit-4.5.0.zip' -Algorithm SHA256 | Format-List Hash, Path
```

Move `bulkreg-kit-4.5.0.zip` to B through an **approved internal channel** (internal file share such as `\\<fileserver>\<share>\bulkreg`, or an encrypted removable drive). On B:

```powershell
Get-FileHash '<path>\bulkreg-kit-4.5.0.zip' -Algorithm SHA256   # must equal the hash shown on A
Expand-Archive '<path>\bulkreg-kit-4.5.0.zip' -DestinationPath '<KIT>' -Force
```

If the hashes differ, delete the copy and transfer again. Do not use a kit that does not match.

### 2.2 Paste the two libraries into Designer (on each machine)

The libraries are plain UTF-8 text. Do not open them in Word. To put one on the clipboard without opening it:

```powershell
Get-Content -LiteralPath '<KIT>\lotusscript\BulkRegCommon.lss' -Raw -Encoding UTF8 | Set-Clipboard
```

1. Back up first: copy the local `bulkreg.nsf` and `config\bulkreg.ini` somewhere safe (section 3).
2. Open the local `bulkreg.nsf` in **Domino Designer**.
3. **Script Libraries > BulkRegCommon**: click in the editor, `Ctrl+A`, `Ctrl+V` (the clipboard holds `BulkRegCommon.lss`), `Ctrl+S`. **Do the Common library first.**
4. Run the clipboard command again for `BulkRegAgents.lss`. **Script Libraries > BulkRegAgents**: click in the editor, `Ctrl+A`, `Ctrl+V`, `Ctrl+S`.
5. **Tools > Recompile All LotusScript**. If a compile error appears, note the exact message and line and stop; do not edit the code on one machine only.
6. Re-sign the database with the same ID as before (guide B17a).
7. Check the version: run **01 - Preflight** and open `RUN_INFO.txt` in the new audit folder: it must say `BulkReg 4.5.0` and a `Machines :` line. Do the same on B.

Agents 00 to 11 need no change (only their header comment shows 4.5.0). If you come from before 4.4.0, create the missing agents as described in `DEPLOY-4.4.0.md`.

### 2.3 Make the configuration match (on each machine)

Copy the working `bulkreg.ini` from A to B only if the two machines have the same layout; otherwise keep B's own file. Either way, add the new keys without retyping:

```powershell
cd '<KIT>\scripts\windows'
.\bulkreg.cmd IniCompare
.\bulkreg.cmd IniUpgrade          # preview
.\bulkreg.cmd IniUpgrade -Yes     # adds only the missing keys (backup + read-back check)
```

To compare B's file with A's, copy A's `bulkreg.ini` (it holds no secrets) to B and run `.\bulkreg.cmd IniCompare '<path>\A_bulkreg.ini'`; or use the compare script of section 2.5. Settings that must be **equal** on both machines and the two that must **differ** are listed in `3_config_compare.csv`.

### 2.4 Collect the evidence pack (once per machine)

The collector is **read-only**: it never changes BulkReg or Domino, never copies `secure\` or `ids\`, and refuses to write into them. Script: `<KIT>\scripts\windows\BulkReg_CollectEvidence.ps1` (full listing in the appendix).

On A:

```powershell
cd '<KIT>\scripts\windows'
.\BulkReg_CollectEvidence.ps1 -Machine A -KitDir '<KIT>\lotusscript'
```

On B:

```powershell
cd '<KIT>\scripts\windows'
.\BulkReg_CollectEvidence.ps1 -Machine B -KitDir '<KIT>\lotusscript'
```

Options: `-Base D:\BulkReg` (other install folder), `-Config <path>` (other ini), `-Out <folder>` (default `<Base>\evidence`), `-Full` (adds copies of batch files, results, reports, `RUN_INFO.txt`; contains names and e-mail addresses), `-IncludeAudit` (with `-Full`: adds `*_audit.csv`).

Result: `<Out>\<Machine>_<yyyyMMdd-HHmmss>\` and a `.zip` next to it, plus `<zip>.sha256.txt`. What is inside:

| File | Contents |
|---|---|
| `machine_info.txt` | Computer, user, date, folders used, ini excerpt, a line for the Notes client version (fill it in by hand) |
| `inventory\*_listing.csv` | Name, size, date (and SHA256 for `secure` and `ids`) of batches, reconcile, audit, secure, ids |
| `inventory\kit_hashes.csv` | SHA256 of each `.lss` file |
| `config\` | `bulkreg.ini`, `server_mapping.csv` |
| `redacted\batch_rows.csv` | Machine, BatchFile, Include, UNID, NoteID, HomeServer, Check |
| `redacted\results_rows.csv` | Machine, BatchFile, Timestamp, Action, Result, NoteID, UNID, HomeServer |

Open `machine_info.txt` and fill in the Notes client version and the free-text facts (row 12 of section 1). Then move the **zip** of B to A (or both to a neutral admin PC) through an approved channel and verify:

```powershell
Get-FileHash '<path>\B_<stamp>.zip' -Algorithm SHA256        # compare with B_<stamp>.zip.sha256.txt
Expand-Archive '<path>\B_<stamp>.zip' -DestinationPath '<path>\B_<stamp>' -Force
```

Keep your own full local backup (section 3) on the machine where it was made.

### 2.5 Compare the two machines

Script: `<KIT>\scripts\windows\BulkReg_CompareMachines.ps1`. It reads only the redacted files, the ini and the kit hashes of the two unzipped packs.

```powershell
cd '<KIT>\scripts\windows'
.\BulkReg_CompareMachines.ps1 -PackA '<path>\A_<stamp>' -PackB '<path>\B_<stamp>' -PartitionCount 2 -IndexA 1 -IndexB 2
```

| Output | Meaning | What to do |
|---|---|---|
| `1_overlap.csv` | Users in a batch of **both** machines, with who registered them: `REGISTERED_ON_A`, `REGISTERED_ON_B`, `REGISTERED_ON_BOTH`, `OPEN_ON_BOTH` | Resolve every row (section 7) before partitioning is switched on. `REGISTERED_ON_BOTH` is a duplicate candidate: check 09 |
| `2_partition_preview.csv` | For each batch with unregistered rows: how many belong to this machine's partition and how many to the other (`OtherPartition`), `Verdict` `REFUSED...` or `OK` | Finish a `REFUSED` batch first, with partitioning still off (section 8) |
| `3_config_compare.csv` | Settings that must be equal or must differ | Fix every `PROBLEM` |
| `4_kit_compare.csv` | SHA256 of each `.lss` on both machines | `DIFFERENT` = not the same code: paste the same kit on both (line endings alone can differ if one copy came through git) |
| `summary.txt` | The four results in words | – |

Spot-check two or three overlap rows against the real batch files on A and B before acting on them.

### 2.6 Moving a batch to the other machine on purpose (takeover)

Only when machine X is down for good or you consciously rebalance. The other machine (Y) must not be running that batch.

1. On X (or from its backup): copy the three files of the batch into Y's `BatchDir`:

    ```powershell
    $src = '<X BatchDir>'; $dst = '<Y BatchDir>'; $id = 'BATCH-<run>-<tag>-01'
    Copy-Item -LiteralPath "$src\$id.csv", "$src\${id}_results.csv", "$src\${id}_inprogress.flag" -Destination $dst   # the last two exist only if the batch was started
    ```

2. On Y: **11 - Batch Manager**, then `RECOVER <id>` to see the real state.
3. Set `PartitionOverride=1` in Y's `bulkreg.ini` for this one run, run **03**, then set it back to `0`.
4. Initial passwords for the users registered by this run are in **Y's** `PasswordDir`; passwords from the earlier part of the batch are still on X. Do not copy password files; hand them over from where they are.

### 2.7 What may be sent to someone else for analysis

Allowed (after your data owner agrees): the **default** packs, `compare_*\` reports, `summary.txt`. **Not allowed**: `-Full` packs, `*_audit.csv`, debug logs, anything from `secure\` or `ids\`, screenshots showing user names. Remove or mask names and addresses if a file contains them.

## 3. Freeze and back up (before upgrading)

On **each** machine:

1. Run **11 - Batch Manager** (leave the action empty). Keep the `BATCHSTATUS_<run>.csv` it writes. Note every batch that is `OPEN`, `STOPPED` or `DONE_INCOMPLETE`.
2. Finish a running batch cleanly (create `<BatchDir>\STOP.txt`, wait for the current chunk). Delete `STOP.txt` after the upgrade.
3. Back up the whole install folder:

    ```powershell
    $stamp = Get-Date -Format 'yyyyMMdd-HHmm'
    robocopy 'C:\BulkReg' "D:\backup\BulkReg-$stamp" /E /COPY:DAT /R:1 /W:1 /XD 'C:\BulkReg\evidence'
    Copy-Item '<path>\bulkreg.nsf' "D:\backup\bulkreg-$stamp.nsf"       # the local database
    ```

    The backup contains `secure\` and `ids\`: put it on a **locally encrypted** disk and restrict access; do not move it off the machine.
4. Run **02 - Build Batch** or **03** on only **one machine at a time** until section 6 is finished. The old setup has no protection against two machines registering the same user.
5. Collect the evidence pack of each machine (section 2.4) **before** upgrading, so the state of the old version is on record.

## 4. Upgrade (both machines)

Follow `DEPLOY-4.5.0.md` and section 2.2 and 2.3. Leave **`PartitionCount=1`** (partitioning off) while you work through sections 5, 7, 8 and 9 (clean-up of what the old version left), and only then continue with section 6. If you are older than 4.4.0, do `DEPLOY-4.4.0.md` first (agents 08 to 11 must exist).

## 5. Baseline: find out where things really stand

1. **01 - Preflight Check** on one machine: no errors on config, servers, vault, log database.
2. **09 - Reconcile** on one machine. Read `RECON_<run>_summary.txt`, then `_gaps.csv`, `_duplicates.csv`, `_duplicate_ids.csv`, `_missing_mail.csv`.
3. On **each** machine run **11 - Batch Manager**, then `RECOVER <id>` for every batch that is not `DONE_COMPLETE`.
4. **Overlap check (the main risk of the old setup):** run the compare script (section 2.5) on the two packs and read `1_overlap.csv`. Every row goes to section 7.
5. **Passwords and ID files:** for any user flagged `REGISTERED_NO_RESULT` or `IDFILE_MULTIPLE`, look in `secure\` and `ids\` on **both** machines (listings in `inventory\`) before deciding.

## 6. Switch on partitioning and pilot

Prerequisite: `2_partition_preview.csv` shows no `REFUSED` row, and no `OPEN` or `STOPPED` batch remains on either machine (section 8 finishes them).

1. Set in `bulkreg.ini` on both machines:

    | | Machine A | Machine B |
    |---|---|---|
    | `PartitionCount` | `2` | `2` |
    | `PartitionIndex` | `1` | `2` |
    | `MachineId` | `A` | `B` |
    | `PartitionOverride` | `0` | `0` |

2. **01 - Preflight** on both. In `_batchplan.txt`: *other machine's partition (excluded)* is about half the candidates and the two machines' *Users to register* add up to the total. The log shows `Several machines: partition 1 of 2, machine A` and the capacity WARN.
3. Pilot on both machines at the same time: `BatchSize=2`, `DryRun=1` → **02** → open `BATCH-<run>-A-01.csv` and `BATCH-<run>-B-01.csv`: **no UNID may appear in both**. Then **03** dry run (`WOULD_REGISTER`), `DryRun=0`, **03** live on each, **04 Verify**, **08** dry run (nothing to repair).
4. Negative test: copy A's batch file to B and start 03 on B. It must stop with *contains N user(s) of another machine's partition* and register nothing. Delete the copy afterwards.
5. Duplicate-guard check from `DEPLOY-4.4.0.md` step 4 (a known ID file name in `IDFileDir`, or a user with a known vault ID): 03 must skip exactly that user.
6. Only then raise `BatchSize` (e.g. 1000).

## 7. Duplicates

**Detect:** 01/02 flag `ERROR:DUPLICATE_*`, 03 skips (`SKIPPED_DUPLICATE`). Reports of 09:

| File | Meaning | Action |
|---|---|---|
| `_duplicates.csv` | Several Person documents share an Internet address, short name, objectGUID, common name or mail file (`mail:` key); rows KEEP / DO_NOT_REGISTER / REVIEW. | Review with the business owner. **BulkReg deletes nothing**: remove the unwanted identity via the Administration Process after review. |
| `_duplicate_ids.csv` `IDFILE_MULTIPLE` | More than one ID file for a user. **Only the ID files of the machine you ran 09 on are seen**; run 09 on A and on B and compare the `ids_listing.csv` of both packs. | Keep the ID that is in the vault / was handed out, archive the others manually. |
| `IDFILE_UNREGISTERED` | ID file exists, the Person has no certificate (an earlier attempt). | Check the registration log and the vault **before** registering again. 03 skips the user. |
| `VAULT_UNREGISTERED` (`ReconcileCheckVault=1`) | ID in the vault, Person has no certificate. | **Do not register again.** The vault admin locates the ID; repair the Person document. |

Rows of `1_overlap.csv`: `REGISTERED_ON_A` / `_ON_B`: remove the user from the other machine's open batch (set `Include=N` or rebuild); `OPEN_ON_BOTH`: keep the user in one machine's batch only; `REGISTERED_ON_BOTH`: treat as a duplicate candidate.

**Verify the fix:** re-run 09; the group is gone; 02 no longer shows `ERROR:DUPLICATE_*` for the user.

## 8. Aborted, stopped or hung batch

1. **11 - Batch Manager** on the machine that **built** the batch (it only lists its own batch files). States: `OPEN`, `STOPPED`, `DONE_INCOMPLETE`, `DONE_COMPLETE`.
2. `RECOVER <id>` (read-only) → `RECOVER_<id>_<run>.csv`:

| State | Next step |
|---|---|
| `NOT_REGISTERED` | **03** again on the owning machine (resumes; registered users are skipped), or `REMAINDER <id>`. |
| `REGISTERED_NO_RESULT` | The run died after `RegisterNewUser`. The initial password is in `BulkReg_InitialPasswords_<id>_*.csv` in `PasswordDir` **of the owning machine**; then 08 and 04 for this user. |
| `NO_MAIL` | Section 9. |
| `NOT_IN_VAULT` | Vault/policy action. **Never run 03** for this user. |
| `DUPLICATE` | Section 7. |
| `GONE` | Person document deleted: nothing to do. |
| `OK` | None. |

3. **Resume rules with two machines:** resume a batch only on the machine that owns it. The `StaleRunMinutes` check (flag younger than 30 minutes) sees only the local flag file, so confirm with the other operator that nobody is running it. Other 11 actions (each needs `YES`): `RESUME <id>` (re-open a `DONE_INCOMPLETE` batch), `REMAINDER <id>` (writes `BATCH-<id>-R1.csv`, review, then 03), `CLOSE <id>`.
4. `bulkreg Stop` creates `STOP.txt` in **that machine's** `BatchDir`. Create it on every machine that is running.
5. **Taking over a dead machine's batch:** section 2.6.
6. Finish with **04 Verify**, then **09**.

## 9. Registered, but no mail file

Causes: `MailFileDeferred=1` (by design), an aborted run, a server or path error.

1. **09 - Reconcile** → `RECON_<run>_missing_mail.csv`: `REGISTERED_MAIL_MISSING`, `REGISTERED_MAIL_INCOMPLETE`, `REGISTERED_NO_MAILFILE_ITEM` (the last needs MailServer/MailFile set in the Person document first).
2. `MailTemplate` must be set in `bulkreg.ini` on every machine that runs 08.
3. **08 - Repair Missing Mail Files**, `DryRun=1`, scope empty (all) or the same `RECON_<run>_gaps.csv`. With partitioning on, run it on **both machines**: each repairs only its own users, so they never collide. Read `<scope>_mailrepair_DRYRUN_<run>.csv` (`WOULD_CREATE`) on each.
4. `DryRun=0`, run 08 live, type `REPAIR`. Results `MAIL_CREATED` or `CREATED_PENDING` (replicas still being created by AdminP).
5. **04 Verify** (repeat until replicas are OK), then **09**: `missing_mail.csv` must be empty. A user in the partition of a machine that is down stays unrepaired until that machine runs 08 or you use `PartitionOverride=1`.

08 never overwrites an existing mail file and never touches one that holds documents.

## 10. Routine in production (both machines in parallel)

Each machine, on its own batches: `02` → review → `03` dry run → `DryRun=0` → `03` live → `04` → `08` (dry run, then live) when `MailFileDeferred=1` → set `DryRun=1`. Then, from either machine: **09** and check `_gaps.csv`, `_duplicates.csv`, `_duplicate_ids.csv` are empty. Hand over passwords from **each** machine's `secure\` folder and delete them there.

## 11. Housekeeping and escalation

- **10 - Audit Log Maintenance** with `DryRun=1` first. **Agree `LogEntryRetentionDays`, `LogAuditRetentionDays` and `AuditFolderRetentionDays` with the audit/compliance owner before the first live run** (purge is destructive). Run it per machine for `AuditDir`, once for the shared log database.
- Keep `LogDbLevel=WARN` and `LogDbAudit=CHANGES`.
- Log documents carry a `Machine` item (A, B, ...), so the shared log database shows which machine did what.
- **Suspected security incident**, unexpected certificates/IDs, a password or ID file that left its folder, or vault inconsistencies across many users: stop all runs on all machines (`STOP.txt` on each) and escalate to the Domino/security owner instead of re-running registrations.

## 12. Rollback

`PartitionCount=1` on all machines returns to the 4.4.0 behaviour (and the original "one machine at a time" rule). To go back to the 4.4.0 libraries, paste them from git. Users already registered stay registered.

## Appendix: helper scripts

Both are read-only and live in `<KIT>\scripts\windows\`. Not run by the author: read them and test on a copy first.

<!--include:scripts/windows/BulkReg_CollectEvidence.ps1-->

<!--include:scripts/windows/BulkReg_CompareMachines.ps1-->

## Sources checked

`DEPLOY-4.5.0.md`, `DEPLOY-4.4.0.md`, `README.md`, `config/bulkreg.ini`, `lotusscript/BulkRegCommon.lss` (`BR_PartitionOf`, `BR_NotMyPartition`, `BR_MachineTag`, `BR_BATCH_COLS`, `BR_AuditHeader`, `BR_ResultsDoneIds`, `BR_OpenBatchNoteIDs`, `BR_DupIdFileLoad`), `lotusscript/BulkRegAgents.lss` (01/02/03/08, `BR_RecoverBatch`, reconcile statuses).
