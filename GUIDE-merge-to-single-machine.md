# Merge machine B into machine A (then work from one machine only)

Machine **A** is the one you keep. Machine **B** is retired. Copy B's folders into A, check, then never run BulkReg on B again. Nothing is deleted or overwritten by the merge.

> **Status:** the merge script `scripts/windows/BulkReg_MergeFromMachine.ps1` was not run by its author (no PowerShell was available). Try it on copies of both folders first and read the dry-run report before the real run.

## What gets merged

| B folder | Goes to (A's ini setting) | Contains | Sensitive |
|---|---|---|---|
| `batches\` | `BatchDir` | batch files, `_results.csv`, in-progress flags, reports | names, e-mail |
| `audit\` | `AuditDir` | one folder per run, `RUN_INFO.txt`, `*_audit.csv` | names |
| `reconcile\` | `ReconcileDir` | `RECON_*` reports | names |
| `secure\` | `PasswordDir` | initial-password files | **SECRET** |
| `ids\` | `IDFileDir` | user ID files | **SECRET** |

Same file name and same content: skipped. Same name, different content: **not overwritten**, the B version goes to `C:\BulkReg\merge_conflicts\B\` for you to decide.

## Steps

**1. Stop B.** On B: create `STOP.txt` in B's `BatchDir`, wait for the current chunk to end, close Notes. Run **11 - Batch Manager** (empty action) and keep `BATCHSTATUS_<run>.csv`. Leave `STOP.txt` in place: it keeps BulkReg from running on B by mistake.

**2. Copy B's folder to encrypted media.** The copy contains secrets: use a locally encrypted disk or share with restricted access. Copy, do not move:

```powershell
foreach ($d in 'batches','audit','reconcile','secure','ids') {
    robocopy "C:\BulkReg\$d" "E:\BulkReg_B\$d" /E /COPY:DAT /R:1 /W:1
}
```

**3. Back up A.** Copy `C:\BulkReg` (and take your usual `names.nsf` backup) before the merge.

**4. Dry run on A.** Nothing is copied. Open the report it names. *No script? Use the section "Manual merge (without the script)" below instead of steps 4 and 5.*

```powershell
cd C:\BulkReg\scripts\windows
.\BulkReg_MergeFromMachine.ps1 -Source E:\BulkReg_B -Label B -IncludeSecrets
```

Read `C:\BulkReg\merge_reports\merge_B_DRYRUN_<time>.csv`. `COPY` = will be copied. `SAME` = already on A. `CONFLICT` = same name, different content. The report shows file names and hashes only.

**5. Apply.** Type `MERGE` when asked. A failed file is reported; run it again, copied files then show `SAME`.

```powershell
.\BulkReg_MergeFromMachine.ps1 -Source E:\BulkReg_B -Label B -IncludeSecrets -Apply
```

**6. Set A's `bulkreg.ini` for one machine.**

```
PartitionCount=1
PartitionIndex=1
PartitionOverride=0
MachineId=
DryRun=1
```

**7. Check the result on A.**

- `CONFLICT` rows: compare `merge_conflicts\B\...` with A's file by hand. Never copy over blindly.
- A batch with an in-progress flag was stopped half way: run **11 - Batch Manager**, action `RECOVER <batch id>`, then resume it on A (`RESUME <batch id>`, then 03). B's old batch IDs (`BATCH-<run>-B-01`) work as they are.
- Run **09 - Reconcile**, then follow `GUIDE-reconcile-duplicates.md`.

**8. Retire B.** When reconcile is clean and passwords are handed over:

1. Delete the `E:\BulkReg_B` copy and B's own `secure\` and `ids\` through your normal secure-deletion process (the script never deletes).
2. Keep B's `STOP.txt`. Do not run agents on B again.

## Manual merge (without the script)

Use this instead of steps 4 and 5. Windows `robocopy` does the same job: it copies only files that are **not yet on A** and never overwrites, never deletes. Run in PowerShell on A. `E:\BulkReg_B` is the copy of B from step 2.

> **Never** add `/MIR`, `/PURGE` or `/MOVE`: they delete files or overwrite.

**M1. Dry run** (`/L` = list only, nothing is copied). Drop `'secure','ids'` to leave out the secrets. If A's folders are not under `C:\BulkReg`, use the paths from A's `bulkreg.ini` (`BatchDir`, `AuditDir`, `ReconcileDir`, `PasswordDir`, `IDFileDir`).

```powershell
$map = @{ batches='C:\BulkReg\batches'; audit='C:\BulkReg\audit'; reconcile='C:\BulkReg\reconcile'; secure='C:\BulkReg\secure'; ids='C:\BulkReg\ids' }
foreach ($d in 'batches','audit','reconcile','secure','ids') {
    robocopy "E:\BulkReg_B\$d" $map[$d] /E /XC /XN /XO /XF STOP.txt *.lock /L /NP /NJH /NJS /FP
}
```

Every line listed is a file that will be copied. `/XC /XN /XO` skip every file that already exists on A, so existing files are never replaced.

**M2. Find conflicts** (same name on A and B, different content). This lists only files that exist on both sides and differ in size or date:

```powershell
foreach ($d in 'batches','audit','reconcile','secure','ids') {
    robocopy "E:\BulkReg_B\$d" $map[$d] /E /XL /XF STOP.txt *.lock /L /NP /NJH /NJS /NDL /FP
}
```

No output = no conflicts. A listed file stays untouched on A: compare it with B's version by hand (open both, or `Get-FileHash <file>` on each). If you need B's version, copy it under another name, for example `<name>.fromB`. Never copy over A's file.

**M3. Copy** (the same command without `/L`, with a log):

```powershell
foreach ($d in 'batches','audit','reconcile','secure','ids') {
    robocopy "E:\BulkReg_B\$d" $map[$d] /E /XC /XN /XO /XF STOP.txt *.lock /COPY:DAT /R:1 /W:1 /NP /LOG+:C:\BulkReg\merge_B.log
}
```

Robocopy exit codes 0 to 3 mean success (1 = files copied). 8 or more = an error: read `merge_B.log`.

**M4. Verify.** Every file of B must now exist on A with the same content. This prints nothing when all is well, and one line per missing or different file:

```powershell
foreach ($d in 'batches','audit','reconcile','secure','ids') {
    $s = (Resolve-Path "E:\BulkReg_B\$d").Path
    Get-ChildItem $s -Recurse -File | Where-Object { $_.Name -notin 'STOP.txt' -and $_.Extension -ne '.lock' } | ForEach-Object {
        $t = Join-Path $map[$d] $_.FullName.Substring($s.Length).TrimStart('\')
        if (-not (Test-Path $t)) { "MISSING  $t" }
        elseif ((Get-FileHash $t).Hash -ne (Get-FileHash $_.FullName).Hash) { "DIFFERS  $t" }
    }
}
```

`DIFFERS` rows are the conflicts from M2. `MISSING` rows: run M3 again.

**M5. Incomplete batches.** A batch stopped half way has an in-progress flag. List them, then handle each with **11 - Batch Manager**, action `RECOVER <batch id>` (see step 7):

```powershell
Get-ChildItem C:\BulkReg\batches -Filter *_inprogress.flag
```

Then continue with step 6 (ini) and step 7.

Plain Explorer works too (copy B's folders over A's and choose **Skip** or **Don't replace** on every name clash), but it gives no list of conflicts and no verification: use robocopy and M4.

## Rules from now on

- One machine runs BulkReg. Never two at once.
- New batch IDs have no machine tag (`MachineId` empty).
- If a password or ID file turns up outside `secure\` or `ids\`, rotate it and tell the security owner.
