<#
=====================================================================
 BulkReg_CompareMachines.ps1 - BulkReg 4.5.0 - compare the evidence packs of two machines (READ-ONLY)

 Input : the two pack folders written by BulkReg_CollectEvidence.ps1 (unzip them first). Only the REDACTED files
         (redacted\batch_rows.csv, redacted\results_rows.csv), config\bulkreg.ini and inventory\kit_hashes.csv are read:
         no names, no e-mail addresses, no passwords.
 Output: a report folder with
   1_overlap.csv          users that are in a batch of BOTH machines, and who registered them
   2_partition_preview.csv what 4.5.0 would do with the still-unregistered rows once partitioning is on (REFUSED = 03 would stop)
   3_config_compare.csv   the settings that must be equal / different on the two machines
   4_kit_compare.csv      the .lss files of both machines (same SHA256 = same code)
   summary.txt            the same in words
 It changes nothing in Domino and nothing in the packs.

 Usage:
   .\BulkReg_CompareMachines.ps1 -PackA C:\evidence\A_20261021-101500 -PackB C:\evidence\B_20261021-101700
   .\BulkReg_CompareMachines.ps1 -PackA ... -PackB ... -PartitionCount 2 -IndexA 1 -IndexB 2 -Out C:\evidence\compare

 NOT run by the author (no PowerShell was available when it was written): run it on the two packs and spot-check
 a few overlap rows against the batch files before you rely on the result.
=====================================================================
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$PackA,
    [Parameter(Mandatory = $true)][string]$PackB,
    [string]$Out,                      # default: <PackA parent>\compare_<time>
    [int]$PartitionCount = 2,          # the PartitionCount you are going to use (same on every machine)
    [int]$IndexA = 1,                  # PartitionIndex machine A will get
    [int]$IndexB = 2                   # PartitionIndex machine B will get
)
Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

function Get-Prop($Obj, [string]$Name) {
    $p = $Obj.PSObject.Properties[$Name]
    if ($p -and $null -ne $p.Value) { return [string]$p.Value }
    return ''
}
function Import-PackCsv([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "Missing file: $Path (is this a BulkReg_CollectEvidence pack?)" }
    return @(Import-Csv -LiteralPath $Path -Encoding UTF8)
}
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
# Same rule as BR_PartitionOf in BulkRegCommon.lss: polynomial hash of the UPPER-CASE UNID, modulo 1000003, then modulo N
function Get-PartitionOf([string]$Unid, [int]$N) {
    if ($N -le 1) { return 1 }
    [long]$h = 0
    foreach ($c in $Unid.Trim().ToUpper().ToCharArray()) { $h = ($h * 31 + [int]$c) % 1000003 }
    return [int]($h % $N) + 1
}
function Read-Pack([string]$Pack) {
    $r = @{}
    $r.Info = Get-Content -LiteralPath (Join-Path $Pack 'machine_info.txt') -Encoding UTF8 -TotalCount 2
    $r.Batch = Import-PackCsv (Join-Path $Pack 'redacted\batch_rows.csv')
    $r.Res = Import-PackCsv (Join-Path $Pack 'redacted\results_rows.csv')
    $r.Ini = Get-IniMap (Join-Path $Pack 'config\bulkreg.ini')
    $r.Kit = @()
    $kf = Join-Path $Pack 'inventory\kit_hashes.csv'
    if (Test-Path -LiteralPath $kf) { $r.Kit = @(Import-Csv -LiteralPath $kf -Encoding UTF8) }
    $r.Label = (Split-Path $Pack -Leaf)
    # registered users (same test as BR_ResultsDoneIds: Action=REGISTER and Result starts with REGISTERED)
    $reg = @{}
    foreach ($x in $r.Res) {
        if ($x.BatchFile -eq '(none)') { continue }
        if ((Get-Prop $x 'Action').ToUpper() -eq 'REGISTER' -and (Get-Prop $x 'Result').ToUpper().StartsWith('REGISTERED')) {
            $k = Get-Prop $x 'UNID'
            if ($k -eq '') { $k = 'N:' + (Get-Prop $x 'NoteID') }
            $reg[$k] = $x.BatchFile
        }
    }
    $r.Reg = $reg
    # users in batches (Include=Y), key = UNID (NoteID for rows without UNID), with the batch files they are in
    $inb = @{}
    $unidOf = @{}
    foreach ($x in $r.Batch) {
        if ($x.BatchFile -eq '(none)') { continue }
        if ((Get-Prop $x 'Include').ToUpper() -ne 'Y') { continue }
        $k = Get-Prop $x 'UNID'
        if ($k -eq '') { $k = 'N:' + (Get-Prop $x 'NoteID') }
        if ($inb.ContainsKey($k)) { $inb[$k] = $inb[$k] + ';' + $x.BatchFile } else { $inb[$k] = $x.BatchFile }
        $unidOf[$k] = (Get-Prop $x 'UNID')
    }
    $r.InBatch = $inb
    $r.UnidOf = $unidOf
    return $r
}

foreach ($p in $PackA, $PackB) { if (-not (Test-Path -LiteralPath $p)) { throw "Pack folder not found: $p (unzip the pack first)" } }
if ($PartitionCount -lt 2 -or $PartitionCount -gt 20) { throw 'PartitionCount must be 2 to 20 for a comparison.' }
if ($IndexA -eq $IndexB -or $IndexA -lt 1 -or $IndexB -lt 1 -or $IndexA -gt $PartitionCount -or $IndexB -gt $PartitionCount) { throw 'IndexA and IndexB must be different numbers between 1 and PartitionCount.' }
if (-not $Out) { $Out = Join-Path (Split-Path (Resolve-Path -LiteralPath $PackA).Path -Parent) ('compare_' + (Get-Date -Format 'yyyyMMdd-HHmmss')) }
New-Item -ItemType Directory -Path $Out -Force | Out-Null

$A = Read-Pack $PackA
$B = Read-Pack $PackB
$sum = New-Object System.Collections.ArrayList
[void]$sum.Add("BulkReg machine comparison  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$sum.Add("A = $($A.Label)   B = $($B.Label)")
[void]$sum.Add("Users in batches (Include=Y)  A: $($A.InBatch.Count)   B: $($B.InBatch.Count)")
[void]$sum.Add("Users registered per results  A: $($A.Reg.Count)   B: $($B.Reg.Count)")

# ---------- 1. overlap ----------
$ov = New-Object System.Collections.ArrayList
foreach ($k in $A.InBatch.Keys) {
    if (-not $B.InBatch.ContainsKey($k)) { continue }
    $regA = $A.Reg.ContainsKey($k); $regB = $B.Reg.ContainsKey($k)
    $what = ''
    if ($regA -and $regB) { $what = 'REGISTERED_ON_BOTH: both results files say REGISTERED. Check 09 duplicates / IDFILE_MULTIPLE for this user' }
    elseif ($regA) { $what = 'REGISTERED_ON_A: B must NOT register its row (03 would skip it as already registered, but remove it from B)' }
    elseif ($regB) { $what = 'REGISTERED_ON_B: A must NOT register its row (remove it from A)' }
    else { $what = 'OPEN_ON_BOTH: neither registered yet; only one machine may register this user' }
    [void]$ov.Add([pscustomobject]@{
            UNID = $A.UnidOf[$k]; Key = $k; BatchesA = $A.InBatch[$k]; BatchesB = $B.InBatch[$k]
            RegisteredA = $regA; RegisteredB = $regB; Assessment = $what
        })
}
if ($ov.Count -eq 0) { [void]$ov.Add([pscustomobject]@{ UNID = ''; Key = ''; BatchesA = ''; BatchesB = ''; RegisteredA = ''; RegisteredB = ''; Assessment = 'NO OVERLAP: no user is in a batch of both machines' }) }
$ov | Export-Csv -LiteralPath (Join-Path $Out '1_overlap.csv') -NoTypeInformation -Encoding UTF8
$nOv = @($ov | Where-Object { $_.Key -ne '' }).Count
[void]$sum.Add('')
[void]$sum.Add("1. OVERLAP: $nOv user(s) are in a batch of both machines" + $(if ($nOv -gt 0) { ' -> see 1_overlap.csv, resolve every row before you switch partitioning on' } else { ' (good)' }))

# ---------- 2. partition preview: rows not registered yet and what 03 would do with them under 4.5.0 ----------
$pv = New-Object System.Collections.ArrayList
foreach ($side in @(@{ P = $A; Name = 'A'; Idx = $IndexA }, @{ P = $B; Name = 'B'; Idx = $IndexB })) {
    $open = @{}      # batch file -> counters
    foreach ($k in $side.P.InBatch.Keys) {
        if ($side.P.Reg.ContainsKey($k)) { continue }
        $u = $side.P.UnidOf[$k]
        foreach ($bf in $side.P.InBatch[$k].Split(';')) {
            if (-not $open.ContainsKey($bf)) { $open[$bf] = @{ Open = 0; Mine = 0; Other = 0; NoUnid = 0 } }
            $open[$bf].Open++
            if ($u -eq '') { $open[$bf].NoUnid++ }
            elseif ((Get-PartitionOf $u $PartitionCount) -eq $side.Idx) { $open[$bf].Mine++ }
            else { $open[$bf].Other++ }
        }
    }
    foreach ($bf in ($open.Keys | Sort-Object)) {
        $c = $open[$bf]
        $verdict = 'OK: all open rows belong to this machine'
        if ($c.Other -gt 0) { $verdict = 'REFUSED by 03 once partitioning is on: finish this batch first (partitioning off) or rebuild it' }
        [void]$pv.Add([pscustomobject]@{
                Machine = $side.Name; PartitionIndex = $side.Idx; BatchFile = $bf; OpenRows = $c.Open
                OwnPartition = $c.Mine; OtherPartition = $c.Other; RowsWithoutUnid = $c.NoUnid; Verdict = $verdict
            })
    }
}
if ($pv.Count -eq 0) { [void]$pv.Add([pscustomobject]@{ Machine = ''; PartitionIndex = ''; BatchFile = '(none)'; OpenRows = 0; OwnPartition = 0; OtherPartition = 0; RowsWithoutUnid = 0; Verdict = 'No batch has an unregistered row: partitioning can be switched on' }) }
$pv | Export-Csv -LiteralPath (Join-Path $Out '2_partition_preview.csv') -NoTypeInformation -Encoding UTF8
$nRef = @($pv | Where-Object { $_.Verdict -like 'REFUSED*' }).Count
[void]$sum.Add("2. PARTITION PREVIEW (PartitionCount=$PartitionCount, A=$IndexA, B=$IndexB): $nRef batch(es) with unregistered rows of the other partition" + $(if ($nRef -gt 0) { ' -> finish them BEFORE switching partitioning on' } else { ' (good)' }))

# ---------- 3. config ----------
$mustEqual = 'RegistrationServer', 'DirectoryServer', 'CertifierName', 'HomeServers', 'HomeServerMaxUsers', 'HomeServerAssignment', 'MailFolderPrefix', 'MailFilesPerFolder', 'MailFolderMax', 'MailFileDeferred', 'MailTemplate', 'VaultServer', 'InternetDomain', 'LogServer', 'LogDb', 'LastNameField', 'LastNameSuffixFields', 'LastNameSeparator', 'DuplicateGuard', 'DuplicateCheckMailFile', 'DuplicateCheckIDFile', 'DuplicateCheckVault', 'PartitionCount', 'PartitionOverride'
$mustDiffer = 'PartitionIndex', 'MachineId'
$cfg = New-Object System.Collections.ArrayList
foreach ($k in ($mustEqual + $mustDiffer)) {
    $va = '(not set)'; $vb = '(not set)'
    if ($A.Ini.ContainsKey($k.ToLower())) { $va = $A.Ini[$k.ToLower()] }
    if ($B.Ini.ContainsKey($k.ToLower())) { $vb = $B.Ini[$k.ToLower()] }
    $rule = 'MUST BE EQUAL'; $status = 'OK'
    if ($mustDiffer -contains $k) {
        $rule = 'MUST DIFFER'
        if ($va -eq $vb -and $va -ne '(not set)' -and $va -ne '') { $status = 'PROBLEM: same value on both machines' }
        elseif ($k -eq 'PartitionIndex' -and ($va -eq '(not set)' -or $vb -eq '(not set)')) { $status = 'NOT SET YET (4.5.0 key missing: run IniUpgrade)' }
    }
    elseif ($va -ne $vb) { $status = 'PROBLEM: different' }
    if ($va -match '<.*>' -or $vb -match '<.*>') { $status = $status + ' | placeholder still in the value' }
    [void]$cfg.Add([pscustomobject]@{ Key = $k; Rule = $rule; MachineA = $va; MachineB = $vb; Status = $status })
}
$cfg | Export-Csv -LiteralPath (Join-Path $Out '3_config_compare.csv') -NoTypeInformation -Encoding UTF8
$nCfg = @($cfg | Where-Object { $_.Status -like 'PROBLEM*' }).Count
[void]$sum.Add("3. CONFIG: $nCfg setting(s) with a problem" + $(if ($nCfg -gt 0) { ' -> see 3_config_compare.csv' } else { ' (good)' }))

# ---------- 4. kit hashes ----------
$kit = New-Object System.Collections.ArrayList
if ($A.Kit.Count -gt 0 -and $B.Kit.Count -gt 0) {
    $ha = @{}; foreach ($x in $A.Kit) { $ha[$x.Name] = $x.Sha256 }
    $hb = @{}; foreach ($x in $B.Kit) { $hb[$x.Name] = $x.Sha256 }
    foreach ($n in ((@($ha.Keys) + @($hb.Keys)) | Sort-Object -Unique)) {
        $sa = ''; $sb = ''
        if ($ha.ContainsKey($n)) { $sa = $ha[$n] }
        if ($hb.ContainsKey($n)) { $sb = $hb[$n] }
        $st = 'SAME'
        if ($sa -eq '' -or $sb -eq '') { $st = 'MISSING on one machine' } elseif ($sa -ne $sb) { $st = 'DIFFERENT (line endings or content: compare the files)' }
        [void]$kit.Add([pscustomobject]@{ File = $n; Status = $st; Sha256A = $sa; Sha256B = $sb })
    }
    $nKit = @($kit | Where-Object { $_.Status -ne 'SAME' }).Count
    [void]$sum.Add("4. KIT FILES: $nKit file(s) differ or are missing" + $(if ($nKit -gt 0) { ' -> see 4_kit_compare.csv (paste the same kit version on both machines)' } else { ' (same code on both machines)' }))
}
else {
    [void]$kit.Add([pscustomobject]@{ File = '(no kit_hashes.csv in one or both packs)'; Status = 'Run the collector with -KitDir on both machines'; Sha256A = ''; Sha256B = '' })
    [void]$sum.Add('4. KIT FILES: not compared (collect with -KitDir on both machines)')
}
$kit | Export-Csv -LiteralPath (Join-Path $Out '4_kit_compare.csv') -NoTypeInformation -Encoding UTF8

$sum | Set-Content -LiteralPath (Join-Path $Out 'summary.txt') -Encoding UTF8
Write-Host ''
$sum | ForEach-Object { Write-Host $_ }
Write-Host ''
Write-Host "Report folder: $Out" -ForegroundColor Green
