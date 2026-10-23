<#
=====================================================================
 BulkReg_MergeFromMachine.ps1 - merge the BulkReg folders of ONE other machine into THIS machine
 (goal: from now on every operation runs on a single machine)

 Run it on the machine that will KEEP running BulkReg (the target), in a normal PowerShell, once per other machine.
 It is COPY-ONLY:
   - DRY RUN by default: it only writes a report. Nothing is copied until you add -Apply.
   - It never deletes anything, on either side. It never overwrites a file of the target.
   - Every copied file is verified with SHA256 after the copy.
   - It never changes bulkreg.ini, Domino or the Domino Directory.

 What it merges (source folder -> target folder, same sub-folder names as the ini defaults):
   batches    -> BatchDir      batch files, results, in-progress flags, RECOVER / BATCHSTATUS / mailrepair reports
   audit      -> AuditDir      one folder per run (names are unique by date/time/agent); archive\ included
   reconcile  -> ReconcileDir  RECON_* reports
   secure     -> PasswordDir   SECRET initial-password files   (only with -IncludeSecrets)
   ids        -> IDFileDir     SECRET user ID files            (only with -IncludeSecrets)

 Per file:  COPY (not on target)  |  SAME (identical SHA256, skipped)  |  CONFLICT (same name, different content:
 NOT overwritten; the source version goes to <Base>\merge_conflicts\<Label>\<area>\... for you to decide).
 STOP.txt and lock files are never copied. In-progress flags ARE copied (they tell 11 - Batch Manager that a batch
 was stopped half way) and are listed as INCOMPLETE in the report.

 Source = a COPY of the other machine's BulkReg folder (USB disk, encrypted share, restored backup), e.g. E:\BulkReg_B.
 Do not run it against the other machine's live folder while BulkReg is running there.
 secure\ and ids\ hold secrets: use locally encrypted media, restrict access, and delete the media copy afterwards
 through your normal process. The report lists file NAMES and hashes only, never contents.

 Usage:
   .\BulkReg_MergeFromMachine.ps1 -Source E:\BulkReg_B -Label B                      # dry run, no secrets
   .\BulkReg_MergeFromMachine.ps1 -Source E:\BulkReg_B -Label B -IncludeSecrets      # dry run incl. secure + ids
   .\BulkReg_MergeFromMachine.ps1 -Source E:\BulkReg_B -Label B -IncludeSecrets -Apply

 NOT run by the author (no PowerShell was available when it was written). Try it on a copy of both folders first,
 read the dry-run report, and spot-check a few files before you use -Apply on the real folders.
=====================================================================
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Source,   # copy of the OTHER machine's BulkReg folder
    [Parameter(Mandatory = $true)][string]$Label,    # short label of the other machine (letters/digits), e.g. B
    [string]$Base = 'C:\BulkReg',                    # this machine's BulkReg folder
    [string]$Config,                                 # default <Base>\config\bulkreg.ini
    [switch]$IncludeSecrets,                         # also secure\ and ids\
    [switch]$Apply,                                  # really copy (default is a dry run)
    [switch]$Yes                                     # skip the typed confirmation with -Apply
)
Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

if ($Label -notmatch '^[A-Za-z0-9]{1,12}$') { throw "Label must be 1-12 letters/digits: '$Label'" }

function Get-IniMap([string]$Path) {
    $m = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $m }
    foreach ($line in (Get-Content -LiteralPath $Path -Encoding UTF8)) {
        $t = $line.Trim().TrimStart([char]0xFEFF)
        if ($t.Length -eq 0 -or $t.StartsWith('#') -or $t.StartsWith(';') -or $t.StartsWith('[')) { continue }
        $p = $t.IndexOf('=')
        if ($p -lt 1) { continue }
        $m[$t.Substring(0, $p).Trim().ToLower()] = $t.Substring($p + 1).Trim()
    }
    return $m
}
function Get-IniDir($Map, [string]$Key, [string]$Default) {
    if ($Map.ContainsKey($Key.ToLower()) -and $Map[$Key.ToLower()] -ne '') { return $Map[$Key.ToLower()] }
    return $Default
}
function Get-IniVal($Map, [string]$Key, [string]$Default) { return (Get-IniDir $Map $Key $Default) }

if (-not $Config) { $Config = Join-Path $Base 'config\bulkreg.ini' }
$ini = Get-IniMap $Config
if ($ini.Count -eq 0) { Write-Warning "ini not found or empty: $Config (default folder names are used)" }

$srcRoot = (Resolve-Path -LiteralPath $Source).Path.TrimEnd('\')
$baseRoot = (Resolve-Path -LiteralPath $Base).Path.TrimEnd('\')
if ($srcRoot -ieq $baseRoot) { throw 'Source and Base are the same folder. Source must be a copy of the OTHER machine.' }

# Target folders come from this machine's ini; source folders are the same sub-folder names under -Source.
$areas = @(
    @{ Name = 'batches';   Key = 'BatchDir';     Sub = 'batches';   Secret = $false },
    @{ Name = 'audit';     Key = 'AuditDir';     Sub = 'audit';     Secret = $false },
    @{ Name = 'reconcile'; Key = 'ReconcileDir'; Sub = 'reconcile'; Secret = $false },
    @{ Name = 'secure';    Key = 'PasswordDir';  Sub = 'secure';    Secret = $true },
    @{ Name = 'ids';       Key = 'IDFileDir';    Sub = 'ids';       Secret = $true }
)

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$mode = 'DRYRUN'; if ($Apply) { $mode = 'APPLY' }
$repDir = Join-Path $baseRoot 'merge_reports'
$confDir = Join-Path $baseRoot ('merge_conflicts\' + $Label)
$rows = New-Object System.Collections.ArrayList
$incomplete = New-Object System.Collections.ArrayList

# ---- plan ----------------------------------------------------------------------------------------------
foreach ($a in $areas) {
    if ($a.Secret -and -not $IncludeSecrets) { Write-Host ("[skip] {0}: secrets are only merged with -IncludeSecrets" -f $a.Name); continue }
    $srcDir = Join-Path $srcRoot $a.Sub
    $dstDir = (Get-IniDir $ini $a.Key (Join-Path $baseRoot $a.Sub)).TrimEnd('\')
    if (-not (Test-Path -LiteralPath $srcDir)) { Write-Warning ("source folder not found, skipped: {0}" -f $srcDir); continue }
    if (-not (Test-Path -LiteralPath $dstDir)) { Write-Warning ("target folder not found (will be created with -Apply): {0}" -f $dstDir) }
    $srcFull = (Resolve-Path -LiteralPath $srcDir).Path.TrimEnd('\')
    if ($srcFull -ieq $dstDir) { throw ("Source and target folder are identical for {0}: {1}" -f $a.Name, $dstDir) }
    Write-Host ("[scan] {0}: {1}  ->  {2}" -f $a.Name, $srcFull, $dstDir)

    foreach ($f in (Get-ChildItem -LiteralPath $srcFull -Recurse -File -Force)) {
        $rel = $f.FullName.Substring($srcFull.Length).TrimStart('\')
        $leaf = $f.Name
        if ($leaf -ieq 'STOP.txt' -or $leaf -like '*.lock' -or $leaf -ieq '.DS_Store' -or $leaf -ieq 'Thumbs.db') {
            [void]$rows.Add([pscustomobject]@{ Area = $a.Name; Action = 'IGNORED'; RelPath = $rel; Bytes = $f.Length; SHA256 = ''; Note = 'never copied' })
            continue
        }
        $dst = Join-Path $dstDir $rel
        $h = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash
        $action = 'COPY'; $note = ''
        if (Test-Path -LiteralPath $dst) {
            $h2 = (Get-FileHash -LiteralPath $dst -Algorithm SHA256).Hash
            if ($h -eq $h2) { $action = 'SAME' } else { $action = 'CONFLICT'; $note = 'same name, different content: source copy goes to merge_conflicts' }
        }
        if ($leaf -like '*_inprogress.flag' -and $action -ne 'SAME') {
            [void]$incomplete.Add($rel)
            $note = ($note + ' INCOMPLETE batch (flag present): run 11 RECOVER before resuming').Trim()
        }
        [void]$rows.Add([pscustomobject]@{ Area = $a.Name; Action = $action; RelPath = $rel; Bytes = $f.Length; SHA256 = $h; Note = $note; _src = $f.FullName; _dst = $dst; _dstDir = $dstDir })
    }
}

# ---- apply ---------------------------------------------------------------------------------------------
$cnt = @{ COPY = 0; SAME = 0; CONFLICT = 0; IGNORED = 0 }
foreach ($r in $rows) { $cnt[$r.Action] = $cnt[$r.Action] + 1 }
Write-Host ''
Write-Host ("Plan ({0}): COPY {1}, SAME {2}, CONFLICT {3}, IGNORED {4}, INCOMPLETE batches {5}" -f $mode, $cnt.COPY, $cnt.SAME, $cnt.CONFLICT, $cnt.IGNORED, $incomplete.Count)

if ($Apply -and ($cnt.COPY + $cnt.CONFLICT) -gt 0) {
    if (-not $Yes) {
        $ans = Read-Host 'Nothing is deleted or overwritten. Type MERGE to copy the files above into this machine'
        if ($ans -cne 'MERGE') { throw 'Cancelled (MERGE was not typed). Nothing was copied.' }
    }
    $failed = 0
    foreach ($r in $rows) {
        if ($r.Action -ne 'COPY' -and $r.Action -ne 'CONFLICT') { continue }
        try {
            if ($r.Action -eq 'COPY') { $to = $r._dst } else { $to = Join-Path $confDir ($r.Area + '\' + $r.RelPath) }
            $toDir = Split-Path -Parent $to
            if (-not (Test-Path -LiteralPath $toDir)) { New-Item -ItemType Directory -Path $toDir -Force | Out-Null }
            if (Test-Path -LiteralPath $to) { throw "target exists, refusing to overwrite: $to" }
            Copy-Item -LiteralPath $r._src -Destination $to
            $hv = (Get-FileHash -LiteralPath $to -Algorithm SHA256).Hash
            if ($hv -ne $r.SHA256) { throw "hash mismatch after copy: $to" }
            if ($r.Action -eq 'COPY') { $r.Action = 'COPIED' } else { $r.Action = 'CONFLICT_SAVED' }
        } catch {
            $failed++
            $r.Action = 'FAILED'; $r.Note = $_.Exception.Message
            Write-Warning ("{0} {1}: {2}" -f $r.Area, $r.RelPath, $_.Exception.Message)
        }
    }
    if ($failed -gt 0) { Write-Warning ("{0} file(s) FAILED: see the report. Fix and run again (already copied files show as SAME)." -f $failed) }
}

# ---- report --------------------------------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $repDir)) { New-Item -ItemType Directory -Path $repDir -Force | Out-Null }
$rep = Join-Path $repDir ("merge_{0}_{1}_{2}.csv" -f $Label, $mode, $stamp)
$rows | Select-Object Area, Action, RelPath, Bytes, SHA256, Note | Export-Csv -LiteralPath $rep -NoTypeInformation -Encoding UTF8
Write-Host ("Report (file names and hashes only): {0}" -f $rep)

# ---- what to check on this machine afterwards ------------------------------------------------------------
$pc = Get-IniVal $ini 'PartitionCount' '1'
$po = Get-IniVal $ini 'PartitionOverride' '0'
Write-Host ''
Write-Host 'Next steps on THIS machine:'
if ($pc -ne '1') { Write-Warning ("bulkreg.ini has PartitionCount={0}. Single machine = PartitionCount=1 (and PartitionIndex=1, PartitionOverride=0)." -f $pc) }
elseif ($po -ne '0') { Write-Warning 'PartitionOverride is not 0. Set it back to 0.' }
else { Write-Host '  ini partition settings are already single-machine (PartitionCount=1).' }
if ($cnt.CONFLICT -gt 0) { Write-Warning ("{0} CONFLICT file(s): compare <Base>\merge_conflicts\{1}\ with the target files by hand. Never overwrite blindly." -f $cnt.CONFLICT, $Label) }
if ($incomplete.Count -gt 0) { Write-Warning ("{0} batch(es) with an in-progress flag: run 11 - Batch Manager, then RECOVER <batch id>." -f $incomplete.Count) }
Write-Host '  1. Run 11 - Batch Manager (empty action), then 09 - Reconcile: see GUIDE-reconcile-duplicates.md.'
if ($mode -eq 'DRYRUN') { Write-Host '  (this was a dry run: add -Apply to copy)' }
else { Write-Host '  After you checked everything: delete the media copy of secure\ and ids\ through your normal process. This script never deletes.' }
