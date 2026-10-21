<#
=====================================================================
 BulkReg_CollectEvidence.ps1 - BulkReg 4.5.0 - READ-ONLY evidence pack of ONE machine
 Run it once on EACH machine that ever ran BulkReg (normal, non-elevated PowerShell).

 It never changes BulkReg, Domino or any BulkReg file. It only reads, and writes a new pack folder.

 Default pack (least data, safe to move between the machines):
   machine_info.txt          computer, user, date, PowerShell version, ini excerpt
   inventory\                file listings (name, size, date) of batches, audit, reconcile, secure, ids.
                             secure and ids: names, sizes, dates and SHA256 ONLY - the files are never copied or opened for any other purpose.
   config\                   bulkreg.ini and server_mapping.csv (no secrets by design)
   redacted\batch_rows.csv   one row per batch row: Machine, BatchFile, Include, UNID, NoteID, HomeServer, Check (NO names, NO e-mail)
   redacted\results_rows.csv one row per registration result: Machine, BatchFile, Timestamp, Action, Result, NoteID, UNID, HomeServer
   inventory\kit_hashes.csv  SHA256 of the .lss files (only with -KitDir)
 With -Full the pack also gets COPIES of: batch files, results, flags, RECOVER/BATCHSTATUS/mailrepair reports, RECON_* reports,
 RUN_INFO.txt of every audit run. These contain user names and e-mail addresses (personal data): keep them in an approved,
 access-restricted location; do not send them to external tools.
 With -IncludeAudit (needs -Full) the *_audit.csv of every run is copied as well (large, personal data).

 Usage examples:
   .\BulkReg_CollectEvidence.ps1 -Machine A -KitDir C:\BulkReg\kit\lotusscript
   .\BulkReg_CollectEvidence.ps1 -Machine B -Base D:\BulkReg -Out D:\evidence -Full

 NOT run against a real BulkReg folder by the author (no PowerShell was available when it was written): run it first
 on a copy or read it through, then check the pack it writes.
=====================================================================
#>
[CmdletBinding()]
param(
    [string]$Base = 'C:\BulkReg',
    [string]$Config,                       # default <Base>\config\bulkreg.ini
    [string]$Out,                          # default <Base>\evidence
    [string]$Machine = $env:COMPUTERNAME,  # label of this machine inside the pack (letters/digits)
    [string]$KitDir,                       # folder with BulkRegCommon.lss / BulkRegAgents.lss (optional, for hashes)
    [switch]$Full,
    [switch]$IncludeAudit
)
Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

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
function Get-Prop($Obj, [string]$Name) {
    $p = $Obj.PSObject.Properties[$Name]
    if ($p -and $null -ne $p.Value) { return [string]$p.Value }
    return ''
}
# BulkReg files may be saved by Excel with ';' - detect the delimiter from the header line
function Import-BulkCsv([string]$Path) {
    $first = Get-Content -LiteralPath $Path -TotalCount 1 -Encoding UTF8
    if ($null -eq $first) { return @() }
    $first = ([string]$first).TrimStart([char]0xFEFF)
    $d = ','
    if ($first.Split(';').Count -gt $first.Split(',').Count) { $d = ';' }
    return @(Import-Csv -LiteralPath $Path -Delimiter $d -Encoding UTF8)
}
function Save-Listing([string]$Dir, [string]$File, [switch]$Hash, [switch]$Recurse) {
    if (-not (Test-Path -LiteralPath $Dir)) {
        [pscustomobject]@{ Name = "(folder missing: $Dir)"; Length = ''; LastWriteUtc = ''; Sha256 = '' } | Export-Csv -LiteralPath $File -NoTypeInformation -Encoding UTF8
        return
    }
    $root = (Resolve-Path -LiteralPath $Dir).Path.TrimEnd('\')
    $files = @(Get-ChildItem -LiteralPath $Dir -File -Recurse:$Recurse)
    $rows = @(foreach ($fi in $files) {
            $h = ''
            if ($Hash) { $h = (Get-FileHash -LiteralPath $fi.FullName -Algorithm SHA256).Hash }
            [pscustomobject]@{
                Name         = $fi.FullName.Substring($root.Length).TrimStart('\')
                Length       = $fi.Length
                LastWriteUtc = $fi.LastWriteTimeUtc.ToString('yyyy-MM-dd HH:mm:ss')
                Sha256       = $h
            }
        })
    if ($rows.Count -eq 0) { $rows = @([pscustomobject]@{ Name = '(empty)'; Length = ''; LastWriteUtc = ''; Sha256 = '' }) }
    $rows | Export-Csv -LiteralPath $File -NoTypeInformation -Encoding UTF8
}

# ---------- folders from bulkreg.ini (same defaults as the agents: <BaseDir>\<name>) ----------
if (-not $Config) { $Config = Join-Path $Base 'config\bulkreg.ini' }
if (-not (Test-Path -LiteralPath $Config)) { throw "bulkreg.ini not found: $Config  (use -Config <path>)" }
$ini = Get-IniMap $Config
$baseDir = (Get-IniDir $ini 'BaseDir' ($Base.TrimEnd('\') + '\')).TrimEnd('\')
$dirBatch = (Get-IniDir $ini 'BatchDir' (Join-Path $baseDir 'batches')).TrimEnd('\')
$dirAudit = (Get-IniDir $ini 'AuditDir' (Join-Path $baseDir 'audit')).TrimEnd('\')
$dirSecure = (Get-IniDir $ini 'PasswordDir' (Join-Path $baseDir 'secure')).TrimEnd('\')
$dirIds = (Get-IniDir $ini 'IDFileDir' (Join-Path $baseDir 'ids')).TrimEnd('\')
$dirRecon = (Get-IniDir $ini 'ReconcileDir' (Join-Path $baseDir 'reconcile')).TrimEnd('\')
$mapFile = Get-IniDir $ini 'MappingFile' (Join-Path $baseDir 'config\server_mapping.csv')

$Machine = ($Machine -replace '[^A-Za-z0-9]', '')
if ($Machine -eq '') { throw 'Machine label must contain letters or digits.' }
if (-not $Out) { $Out = Join-Path $baseDir 'evidence' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$pack = Join-Path $Out ("{0}_{1}" -f $Machine, $stamp)

# the pack must never be written inside the secure or ids folder
foreach ($forbidden in @($dirSecure, $dirIds)) {
    $o = [IO.Path]::GetFullPath($Out).TrimEnd('\') + '\'
    $f = [IO.Path]::GetFullPath($forbidden).TrimEnd('\') + '\'
    if ($o.StartsWith($f, [StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to write the pack inside $forbidden - choose another -Out." }
}
New-Item -ItemType Directory -Path (Join-Path $pack 'inventory'), (Join-Path $pack 'config'), (Join-Path $pack 'redacted') -Force | Out-Null
Write-Host "Pack folder: $pack"

# ---------- machine_info.txt ----------
$info = @()
$info += "BulkReg evidence pack (read-only collection)"
$info += "Machine label   : $Machine"
$info += "Computer name   : $env:COMPUTERNAME"
$info += "Windows user    : $env:USERDOMAIN\$env:USERNAME"
$info += "Collected (local): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')   (UTC $((Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss')))"
$info += "PowerShell       : $($PSVersionTable.PSVersion)"
$info += "Mode            : $(if ($Full) { 'FULL (copies of batch/report files)' } else { 'DEFAULT (listings + redacted rows only)' })"
$info += "Config file     : $Config"
$info += "BatchDir        : $dirBatch"
$info += "AuditDir        : $dirAudit"
$info += "PasswordDir     : $dirSecure   (names/sizes/hashes only, never copied)"
$info += "IDFileDir       : $dirIds   (names/sizes/hashes only, never copied)"
$info += "ReconcileDir    : $dirRecon"
$info += "Notes client version: (write it in by hand: Help > About Notes)"
$info += ""
$info += "ini excerpt (no secrets are kept in bulkreg.ini by design):"
foreach ($k in 'PartitionCount', 'PartitionIndex', 'MachineId', 'PartitionOverride', 'DryRun', 'BatchSize', 'RegistrationServer', 'DirectoryServer', 'CertifierName', 'HomeServers', 'HomeServerMaxUsers', 'HomeServerAssignment', 'MailFileDeferred', 'MailFolderMax', 'VaultServer', 'LogServer', 'LogDb', 'DuplicateGuard') {
    $v = '(not set)'
    if ($ini.ContainsKey($k.ToLower())) { $v = $ini[$k.ToLower()] }
    $info += ("  {0,-22}= {1}" -f $k, $v)
}
$info | Set-Content -LiteralPath (Join-Path $pack 'machine_info.txt') -Encoding UTF8

# ---------- inventory (no content copied) ----------
Save-Listing $dirBatch (Join-Path $pack 'inventory\batches_listing.csv')
Save-Listing $dirRecon (Join-Path $pack 'inventory\reconcile_listing.csv')
Save-Listing $dirAudit (Join-Path $pack 'inventory\audit_listing.csv') -Recurse
Save-Listing $dirSecure (Join-Path $pack 'inventory\secure_listing.csv') -Hash
Save-Listing $dirIds (Join-Path $pack 'inventory\ids_listing.csv') -Hash
if ($KitDir) {
    if (-not (Test-Path -LiteralPath $KitDir)) { throw "KitDir not found: $KitDir" }
    @(Get-ChildItem -LiteralPath $KitDir -Filter '*.lss' -File | Sort-Object Name | ForEach-Object {
            [pscustomobject]@{ Name = $_.Name; Length = $_.Length; Sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
        }) | Export-Csv -LiteralPath (Join-Path $pack 'inventory\kit_hashes.csv') -NoTypeInformation -Encoding UTF8
}

# ---------- config ----------
Copy-Item -LiteralPath $Config -Destination (Join-Path $pack 'config\bulkreg.ini')
if (Test-Path -LiteralPath $mapFile) { Copy-Item -LiteralPath $mapFile -Destination (Join-Path $pack 'config\server_mapping.csv') }

# ---------- redacted rows: batch files (the batch itself has no '_' in its name) ----------
$batchRows = New-Object System.Collections.ArrayList
if (Test-Path -LiteralPath $dirBatch) {
    foreach ($bf in (Get-ChildItem -LiteralPath $dirBatch -Filter 'BATCH-*.csv' -File | Where-Object { $_.Name -notmatch '_' } | Sort-Object Name)) {
        foreach ($r in (Import-BulkCsv $bf.FullName)) {
            [void]$batchRows.Add([pscustomobject]@{
                    Machine = $Machine; BatchFile = $bf.BaseName; Include = (Get-Prop $r 'Include')
                    UNID = (Get-Prop $r 'UNID'); NoteID = (Get-Prop $r 'NoteID'); HomeServer = (Get-Prop $r 'HomeServer'); Check = (Get-Prop $r 'Check')
                })
        }
    }
}
if ($batchRows.Count -eq 0) { [void]$batchRows.Add([pscustomobject]@{ Machine = $Machine; BatchFile = '(none)'; Include = ''; UNID = ''; NoteID = ''; HomeServer = ''; Check = '' }) }
$batchRows | Export-Csv -LiteralPath (Join-Path $pack 'redacted\batch_rows.csv') -NoTypeInformation -Encoding UTF8

# ---------- redacted rows: live results (<batch>_results.csv; dry runs are NOT results) ----------
$resRows = New-Object System.Collections.ArrayList
if (Test-Path -LiteralPath $dirBatch) {
    foreach ($rf in (Get-ChildItem -LiteralPath $dirBatch -Filter 'BATCH-*_results.csv' -File | Sort-Object Name)) {
        $bid = $rf.BaseName -replace '_results$', ''
        foreach ($r in (Import-BulkCsv $rf.FullName)) {
            [void]$resRows.Add([pscustomobject]@{
                    Machine = $Machine; BatchFile = $bid; Timestamp = (Get-Prop $r 'Timestamp'); Action = (Get-Prop $r 'Action')
                    Result = (Get-Prop $r 'Result'); NoteID = (Get-Prop $r 'NoteID'); UNID = (Get-Prop $r 'UNID'); HomeServer = (Get-Prop $r 'HomeServer')
                })
        }
    }
}
if ($resRows.Count -eq 0) { [void]$resRows.Add([pscustomobject]@{ Machine = $Machine; BatchFile = '(none)'; Timestamp = ''; Action = ''; Result = ''; NoteID = ''; UNID = ''; HomeServer = '' }) }
$resRows | Export-Csv -LiteralPath (Join-Path $pack 'redacted\results_rows.csv') -NoTypeInformation -Encoding UTF8

# ---------- optional: copies (personal data) ----------
if ($Full) {
    $dBatch = Join-Path $pack 'batches'; $dRecon = Join-Path $pack 'reconcile'; $dAudit = Join-Path $pack 'audit'
    New-Item -ItemType Directory -Path $dBatch, $dRecon, $dAudit -Force | Out-Null
    if (Test-Path -LiteralPath $dirBatch) {
        foreach ($pat in 'BATCH-*', '*_mailrepair_*', 'BATCHSTATUS_*', 'RECOVER_*', 'STOP.txt') {
            Get-ChildItem -LiteralPath $dirBatch -Filter $pat -File | Copy-Item -Destination $dBatch -Force
        }
    }
    if (Test-Path -LiteralPath $dirRecon) { Get-ChildItem -LiteralPath $dirRecon -Filter 'RECON_*' -File | Copy-Item -Destination $dRecon -Force }
    if (Test-Path -LiteralPath $dirAudit) {
        foreach ($rd in (Get-ChildItem -LiteralPath $dirAudit -Directory)) {
            $t = Join-Path $dAudit $rd.Name
            New-Item -ItemType Directory -Path $t -Force | Out-Null
            Get-ChildItem -LiteralPath $rd.FullName -Filter 'RUN_INFO.txt' -File | Copy-Item -Destination $t -Force
            if ($IncludeAudit) { Get-ChildItem -LiteralPath $rd.FullName -Filter '*_audit.csv' -File | Copy-Item -Destination $t -Force }
        }
    }
}

# ---------- zip + hash ----------
$zip = "$pack.zip"
Compress-Archive -Path (Join-Path $pack '*') -DestinationPath $zip -Force
$zh = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
"$zh  $(Split-Path $zip -Leaf)" | Set-Content -LiteralPath "$zip.sha256.txt" -Encoding ASCII

Write-Host ''
Write-Host "Batch rows (redacted): $($batchRows.Count)   Result rows (redacted): $($resRows.Count)" -ForegroundColor Green
Write-Host "Pack folder : $pack"
Write-Host "Pack zip    : $zip"
Write-Host "SHA256      : $zh   (also in $zip.sha256.txt)"
Write-Host ''
if ($Full) { Write-Host 'FULL pack: contains names and e-mail addresses. Store only in an approved, access-restricted location.' -ForegroundColor Yellow }
else { Write-Host 'Default pack: no names, no e-mail addresses, no passwords, no ID files. UNID/NoteID are internal Domino identifiers.' -ForegroundColor Yellow }
Write-Host 'secure\ and ids\ were NOT copied (listing + SHA256 only).'
