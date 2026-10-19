<#
=====================================================================
 bulkreg.ps1  -  BulkReg 4.4.0 OPTIONAL helper for the Windows admin workstation
                 (the machine running the HCL Domino Administrator client)

 Registration runs entirely inside the Domino Administrator client
 (agents in bulkreg.nsf > Actions). This script never registers users and
 never touches names.nsf. It only automates the Windows chores around a run:

   Init          create C:\BulkReg\{config,ids,secure,audit,cert,batches}, lock down
                 ids / secure / cert, copy the config templates
   Check         validate folders, ACLs and config values before a run
   DryRun On|Off flip DryRun in bulkreg.ini (backup + diff)
   Batches       list batch files and their state (OPEN / DRYRUN / DONE)
   Status        summarise the newest (or a given) audit or results CSV
   Tail          follow the newest debug log while an agent runs
   PurgeSecrets  list / delete initial-password files, text files, local IDs
   IniCompare    compare YOUR bulkreg.ini with the kit template: missing / unknown / different / placeholders
   IniUpgrade    add ONLY the keys missing in your bulkreg.ini (your values stay; preview unless -Yes; backup)
                 (neither needs administrator rights: the config folder is not restricted by Init)

 Usage:  .\bulkreg.cmd <Command> [options]        (.\bulkreg.cmd Help)
 Every state-changing command is written to <AuditDir>\bulkreg_admin_actions.log
=====================================================================
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Help', 'Init', 'Check', 'DryRun', 'Batches', 'Status', 'Tail', 'PurgeSecrets', 'Versions', 'Stop', 'Unstop', 'IniCompare', 'IniUpgrade')]
    [string]$Command = 'Help',
    [Parameter(Position = 1)] [string]$Arg,
    [string]$Base = $(if ($env:BULKREG_BASE) { $env:BULKREG_BASE } else { 'C:\BulkReg' }),
    [string]$Config,
    [string]$Template,
    [string]$Out,
    [switch]$IncludeIds,
    [switch]$Yes
)
Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
$Version = '4.4.0'
if (-not $Config) { $Config = if ($env:BULKREG_CONFIG) { $env:BULKREG_CONFIG } else { Join-Path $Base 'config\bulkreg.ini' } }
$KitConfig = Join-Path $PSScriptRoot '..\..\config'
$script:Fails = 0; $script:Warns = 0
function Pass($m) { Write-Host "PASS  $m" -ForegroundColor Green }
function Fail($m) { Write-Host "FAIL  $m" -ForegroundColor Red; $script:Fails++ }
function Warn($m) { Write-Host "WARN  $m" -ForegroundColor Yellow; $script:Warns++ }

# ---------- config helpers ----------
function Get-Cfg([string]$Key, [string]$Default = '') {
    if (-not (Test-Path $Config)) { return $Default }
    foreach ($l in Get-Content -LiteralPath $Config -Encoding UTF8) {
        $t = $l.Trim()
        if ($t -eq '' -or $t -match '^[#;\[]') { continue }
        $i = $t.IndexOf('=')
        if ($i -gt 0 -and $t.Substring(0, $i).Trim() -ieq $Key) {
            $v = $t.Substring($i + 1).Trim(); if ($v -ne '') { return $v } else { return $Default }
        }
    }
    return $Default
}
function Get-CfgDir([string]$Key, [string]$Sub) { (Get-Cfg $Key (Join-Path $Base $Sub)).Replace('/', '\').TrimEnd('\') }

function Write-Action([string]$Text) {
    $a = Get-CfgDir 'AuditDir' 'audit'
    if (Test-Path $a) {
        "{0}`t{1}`t{2}`t{3}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), "$env:USERDOMAIN\$env:USERNAME", $env:COMPUTERNAME, $Text |
            Add-Content -LiteralPath (Join-Path $a 'bulkreg_admin_actions.log') -Encoding UTF8
    }
}

function Set-Cfg([string]$Key, [string]$Value) {
    if (-not (Test-Path $Config)) { throw "Config not found: $Config" }
    $bak = "$Config.bak.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item -LiteralPath $Config -Destination $bak
    $lines = @(Get-Content -LiteralPath $Config -Encoding UTF8)
    $found = $false
    $new = foreach ($l in $lines) {
        if ($l -match "^\s*$([regex]::Escape($Key))\s*=") { $found = $true; "$Key=$Value" } else { $l }
    }
    if (-not $found) { $new = @($new) + "$Key=$Value" }
    Set-Content -LiteralPath $Config -Value $new -Encoding UTF8
    Write-Host "Changed $Config (backup: $bak)"
    Compare-Object (Get-Content $bak) (Get-Content $Config) | ForEach-Object { "  {0} {1}" -f $(if ($_.SideIndicator -eq '=>') { '+' } else { '-' }), $_.InputObject }
    Write-Action "Set-Cfg $Key=$Value"
}

function Get-Latest([string]$Pattern) {
    # audit files are in one sub-folder per run (<date>_<time>_<agent>_<mode>) - search recursively
    Get-ChildItem -Path (Get-CfgDir 'AuditDir' 'audit') -Filter $Pattern -File -Recurse -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

# Restrict a folder to Administrators + SYSTEM + the current admin user
function Set-RestrictedAcl([string]$Path) {
    & icacls $Path /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' "${env:USERDOMAIN}\${env:USERNAME}:(OI)(CI)F" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "icacls failed for $Path" }
}

# ---------- commands ----------
function Show-Help {
@"
bulkreg.ps1 $Version - optional helper for the Windows Domino Administrator workstation
Base=$Base  Config=$Config

  Init                               Create $Base\{config,ids,secure,audit,cert,batches}, restrict ids/secure/cert/batches,
                                     copy config templates if missing (run as Administrator)
  Check                              Validate folders, ACLs and config values
  DryRun On|Off                      Set DryRun=1 / 0 in bulkreg.ini (backup + diff)
  Stop | Unstop                      Create / delete <BatchDir>\STOP.txt (clean stop of a chunked 03 run)
  Batches                            List batch files: rows, Include=Y, state (OPEN / DRYRUN / DONE)
  Status [file.csv]                  Summarise an audit or BATCH-*_results.csv by Result (default: newest audit)
  Tail                               Follow the newest debug log
  PurgeSecrets [-IncludeIds] [-Yes]  List (default) or delete password/text files (and local ID files)
  Versions                           Check that every kit file carries the release number in VERSION
  IniCompare [other.ini] [-Out f.csv]  Compare your bulkreg.ini with the kit template (or with other.ini): MISSING keys
                                     (with the release that introduced them), UNKNOWN / RETIRED keys, values that DIFFER,
                                     <PLACEHOLDER>s still in your file, duplicate keys. Read-only. -Out writes a CSV.
  IniUpgrade [-Template t.ini] [-Yes]  Insert the keys that are missing in your bulkreg.ini, with their comments and the
                                     template default, right after the key that precedes them in the template. Existing
                                     values, comments and order are never touched. Without -Yes: preview only. With -Yes:
                                     backup (bulkreg.ini.bak.<time>), write, re-read and verify, show the added lines.

The agents themselves are run from bulkreg.nsf > Actions in the Domino Administrator client.
"@ | Write-Host
}

function Invoke-Init {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) { throw 'Init must run in an elevated PowerShell (Run as Administrator).' }
    foreach ($d in 'config', 'ids', 'secure', 'audit', 'cert', 'batches') { New-Item -ItemType Directory -Force -Path (Join-Path $Base $d) | Out-Null }
    foreach ($d in 'ids', 'secure', 'cert', 'batches') { Set-RestrictedAcl (Join-Path $Base $d) }
    foreach ($f in 'bulkreg.ini', 'server_mapping.csv') {
        $dst = Join-Path $Base "config\$f"; $src = Join-Path $KitConfig $f
        if (-not (Test-Path $dst) -and (Test-Path $src)) { Copy-Item $src $dst; Write-Host "Installed template -> $dst" }
    }
    Get-ChildItem $Base | Format-Table Name, LastWriteTime -AutoSize
    $script:Config = Join-Path $Base 'config\bulkreg.ini'; Write-Action "Init base=$Base"
    Write-Host "Next: edit $script:Config, then: .\bulkreg.cmd Check"
}

function Test-RestrictedAcl([string]$Path) {
    if (-not (Test-Path $Path)) { Fail "missing folder $Path"; return }
    $acl = Get-Acl $Path
    if (-not $acl.AreAccessRulesProtected) { Warn "$Path inherits permissions (run Init to restrict)" }
    $wide = $acl.Access | Where-Object { $_.IdentityReference -match 'Everyone|\\Users$|Authenticated Users' }
    if ($wide) { Fail "$Path grants access to $(($wide.IdentityReference | Select-Object -Unique) -join ', ')" } else { Pass "$Path restricted" }
}

function Invoke-Check {
    Write-Host '== Files and permissions'
    if (Test-Path $Config) { Pass "config $Config" } else { Fail "config $Config not found"; Show-Summary; return }
    Test-RestrictedAcl (Get-CfgDir 'IDFileDir' 'ids')
    Test-RestrictedAcl (Get-CfgDir 'PasswordDir' 'secure')
    Test-RestrictedAcl (Get-CfgDir 'BatchDir' 'batches')
    $audit = Get-CfgDir 'AuditDir' 'audit'
    if (Test-Path $audit) { Pass "audit folder $audit" } else { Fail "audit folder $audit missing" }
    $map = Get-Cfg 'MappingFile' (Join-Path $Base 'config\server_mapping.csv')
    if (Test-Path $map) { Pass "mapping $map" } else { Fail "mapping $map not found" }

    Write-Host '== Config values'
    $ph = Select-String -LiteralPath $Config -Pattern '<[^>]+>' | Where-Object { $_.Line -notmatch '^\s*#' }
    if ($ph) { Fail "unreplaced <PLACEHOLDER> on line(s) $(($ph.LineNumber) -join ', ')" } else { Pass 'no <PLACEHOLDER> values left' }
    if ((Get-Cfg 'UseCA' '1') -eq '1') {
        if (Get-Cfg 'CertifierName') { Pass 'UseCA=1 with CertifierName' } else { Fail 'UseCA=1 but CertifierName empty' }
    } else {
        $cid = Get-Cfg 'CertifierIDFile'
        if ($cid -and (Test-Path $cid)) { Pass "certifier ID file $cid" } else { Fail "UseCA=0 but certifier ID file not found: $cid" }
    }
    $shippedIni = Join-Path $KitConfig 'bulkreg.ini'
    if (Test-Path -LiteralPath $shippedIni) {
        $myIni = Read-Ini $Config
        $miss = @((Read-Ini $shippedIni).Map.Keys | Where-Object { -not $myIni.Map.Contains($_) })
        if ($miss.Count -eq 0) { Pass 'bulkreg.ini has every key of the kit template' }
        else { Warn "$($miss.Count) key(s) of the kit template are missing in your bulkreg.ini (built-in defaults apply): run  bulkreg.cmd IniCompare  then  IniUpgrade" }
    }
    if ((Get-Cfg 'DryRun' '1') -eq '1') { Pass 'DryRun=1 (safe)' } else { Warn 'DryRun=0 - LIVE mode' }
    if (Get-Cfg 'DefaultPolicy') { Pass 'DefaultPolicy set' } else { Warn 'DefaultPolicy empty - make sure a policy assigns the ID Vault' }
    if (Get-Cfg 'VaultServer') { Pass 'VaultServer set' } else { Warn 'VaultServer empty - no vault verification' }

    Write-Host '== Workstation'
    if (Get-Process -Name nlnotes, notes2, notes -ErrorAction SilentlyContinue) { Pass 'Notes / Domino Administrator client is running' }
    else { Warn 'Domino Administrator client not running (start it before running the agents)' }
    Show-Summary
}
# ---------- version consistency of the kit (read-only) ----------
function Test-Versions {
    $kit = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $want = (Get-Content -LiteralPath (Join-Path $kit 'VERSION') -TotalCount 1).Trim()
    Write-Host "Kit: $kit   VERSION: $want"
    $checks = @(
        @{ File = 'lotusscript\BulkRegCommon.lss';             Pattern = 'BR_VERSION = "([0-9.]+)"' },
        @{ File = 'lotusscript\BulkRegAgents.lss';             Pattern = 'BulkRegAgents\s+Version ([0-9.]+)' },
        @{ File = 'lotusscript\Agent00_SetUpLogDatabase.lss';  Pattern = 'Version\s*:\s*([0-9.]+)' },
        @{ File = 'lotusscript\Agent01_Preflight.lss';         Pattern = 'Version\s*:\s*([0-9.]+)' },
        @{ File = 'lotusscript\Agent02_BuildBatch.lss';        Pattern = 'Version\s*:\s*([0-9.]+)' },
        @{ File = 'lotusscript\Agent03_RegisterBatch.lss';     Pattern = 'Version\s*:\s*([0-9.]+)' },
        @{ File = 'lotusscript\Agent04_VerifyVaultStatus.lss'; Pattern = 'Version\s*:\s*([0-9.]+)' },
        @{ File = 'lotusscript\Agent05_ExportToBatchRegFile.lss'; Pattern = 'Version\s*:\s*([0-9.]+)' },
        @{ File = 'lotusscript\Agent06_InstallWelcomePage.lss'; Pattern = 'Version\s*:\s*([0-9.]+)' },
        @{ File = 'lotusscript\Agent08_RepairMailFiles.lss';  Pattern = 'Version\s*:\s*([0-9.]+)' },
        @{ File = 'lotusscript\Agent09_Reconcile.lss';        Pattern = 'Version\s*:\s*([0-9.]+)' },
        @{ File = 'lotusscript\Agent10_AuditMaintenance.lss'; Pattern = 'Version\s*:\s*([0-9.]+)' },
        @{ File = 'lotusscript\Agent11_BatchManager.lss';    Pattern = 'Version\s*:\s*([0-9.]+)' },
        @{ File = 'config\bulkreg.ini';                         Pattern = 'BulkReg ([0-9.]+)' },
        @{ File = 'config\server_mapping.csv';                  Pattern = 'BulkReg ([0-9.]+)' },
        @{ File = 'scripts\windows\bulkreg.cmd';                Pattern = 'BulkReg ([0-9.]+)' },
        @{ File = 'tools\BulkReg_AuditViewer.html';              Pattern = '>v([0-9.]+)<' },
        @{ File = 'README.md';                                  Pattern = 'BulkReg ([0-9.]+)' },
        @{ File = 'CHANGELOG.md';                               Pattern = '\| \*\*([0-9.]+)\*\* \|' },
        @{ File = 'docs\BulkReg_Admin_Guide.html';               Pattern = 'Version ([0-9.]+)<' }
    )
    if ($Version -eq $want) { Pass "bulkreg.ps1 $Version" } else { Fail "bulkreg.ps1 is $Version, VERSION is $want" }
    foreach ($c in $checks) {
        $p = Join-Path $kit $c.File
        if (-not (Test-Path -LiteralPath $p)) { Warn "$($c.File) not found"; continue }
        $m = [regex]::Match((Get-Content -LiteralPath $p -Raw -Encoding UTF8), $c.Pattern)
        if (-not $m.Success) { Warn "$($c.File): no version found" }
        elseif ($m.Groups[1].Value -eq $want) { Pass "$($c.File) $($m.Groups[1].Value)" }
        else { Fail "$($c.File) is $($m.Groups[1].Value), VERSION is $want" }
    }
    Write-Host 'In bulkreg.nsf: the first line of every debug log shows the version the agents were compiled with (==== BulkReg <version>).'
    Show-Summary
}

function Show-Summary { Write-Host "`nResult: $script:Fails fail(s), $script:Warns warning(s)" }

function Show-Status([string]$File) {
    if (-not $File) { $f = Get-Latest '*_audit.csv'; if (-not $f) { throw 'no audit CSV found' }; $File = $f.FullName }
    $rows = @(Import-Csv -LiteralPath $File -Encoding UTF8)
    Write-Host "Audit file: $File"
    if ($rows.Count -eq 0) { Write-Host '(empty)'; return }
    Write-Host ("Run {0}  tool={1}  mode={2}  operator={3}  rows={4}" -f $rows[0].RunID, $rows[0].Tool, $rows[0].Mode, $rows[0].Operator, $rows.Count)
    $rows | Group-Object Result | Sort-Object Count -Descending | Format-Table @{n = 'Result'; e = { $_.Name } }, Count -AutoSize
    if ($rows[0].PSObject.Properties.Name -contains 'ReplicaStatus') {
        # cluster replicas (3.8.0+): group by status without the server details
        $rows | Where-Object { $_.ReplicaStatus } | Group-Object { ($_.ReplicaStatus -split ' \(')[0] } | Sort-Object Count -Descending |
            Format-Table @{n = 'ReplicaStatus'; e = { $_.Name } }, Count -AutoSize
    }
    $bad = $rows | Where-Object { $_.Result -match '^(FAIL|ERROR|CHECK_ERROR)' -or $_.Result -match 'PENDING' -or $_.ReplicaStatus -match 'MISSING|FAILED' }
    if ($bad) { Write-Host 'Needs attention (first 15):'; $bad | Select-Object -First 15 Result, FullNameBefore, Message | Format-Table -AutoSize -Wrap }
}

function Show-Batches {
    $d = Get-CfgDir 'BatchDir' 'batches'
    $files = @(Get-ChildItem -LiteralPath $d -Filter 'BATCH-*.csv' -File -ErrorAction SilentlyContinue | Where-Object { $_.BaseName -notmatch '_' } | Sort-Object Name)
    if ($files.Count -eq 0) { Write-Host "No batch files in $d"; return }
    $files | ForEach-Object {
        $rows = @(Import-Csv -LiteralPath $_.FullName -Encoding UTF8)
        $inc = @($rows | Where-Object { $_.Include -eq 'Y' }).Count
        $res = Join-Path $d "$($_.BaseName)_results.csv"
        $dry = @(Get-ChildItem -LiteralPath $d -Filter "$($_.BaseName)_dryrun_*.csv" -File -ErrorAction SilentlyContinue)
        $flag = Join-Path $d "$($_.BaseName)_inprogress.flag"
        $state = if ((Test-Path $res) -and (Test-Path $flag)) { 'STOPPED HALF WAY (run 03 to resume)' } elseif (Test-Path $res) { 'DONE' } elseif ($dry.Count -gt 0) { 'OPEN (dry-run done)' } else { 'OPEN' }
        [pscustomobject]@{ Batch = $_.BaseName; Rows = $rows.Count; IncludeY = $inc; State = $state; Built = $_.CreationTime }
    } | Format-Table -AutoSize
}

function Show-Tail { $f = Get-Latest '*_debug.log'; if (-not $f) { throw 'no debug log yet' }; Write-Host "Following $($f.FullName)"; Get-Content -LiteralPath $f.FullName -Tail 50 -Wait }

function Remove-Secrets {
    $sec = Get-CfgDir 'PasswordDir' 'secure'; $idd = Get-CfgDir 'IDFileDir' 'ids'
    $files = @(Get-ChildItem -LiteralPath $sec -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'BulkReg_InitialPasswords_*.csv' -or $_.Name -like 'BatchReg_DirSync_*.txt' })
    if ($IncludeIds) { $files += @(Get-ChildItem -LiteralPath $idd -Filter *.id -File -ErrorAction SilentlyContinue) }
    if ($files.Count -eq 0) { Write-Host 'Nothing to purge.'; return }
    Write-Host "Will remove ($($files.Count)):"; $files | ForEach-Object { "  $($_.FullName)" }
    if ($IncludeIds) { Warn 'Only remove ID files after Agent 04 shows IN_VAULT for every user.' }
    if (-not $Yes) { Write-Host 'Dry run. Re-run with -Yes to delete.'; return }
    foreach ($f in $files) {
        # overwrite once with zeros before deleting (best effort; SSDs/VSS may keep copies)
        $len = $f.Length; if ($len -gt 0) { [IO.File]::WriteAllBytes($f.FullName, (New-Object byte[] $len)) }
        Remove-Item -LiteralPath $f.FullName -Force
        Write-Action "PurgeSecrets $($f.FullName)"
    }
    Write-Host "Removed $($files.Count) file(s)."
}

# ---------- bulkreg.ini: compare with the template, add only the missing keys (4.4.0) ----------
# Why: every release adds keys to bulkreg.ini. The agents read a missing key with a built-in default, but the
# defaults are not always what you want and the new keys are invisible in your old file. IniUpgrade adds ONLY what is
# missing; IniCompare shows the differences first. Both read the KEY HISTORY lines at the end of the template
# ("# [since 4.3.0] Key, Key") to say which release introduced a key. No administrator rights are needed.

# Parses an ini the way the agents do (bulkreg.ini: key=value, # ; [ start a comment, the LAST duplicate wins)
function Read-Ini([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "ini file not found: $Path" }
    $lines = @(Get-Content -LiteralPath $Path -Encoding UTF8)
    $map = [ordered]@{}
    $dups = New-Object System.Collections.Generic.List[string]
    $ver = ''
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $t = $lines[$i].Trim([char]0xFEFF).Trim()
        if ($ver -eq '' -and $i -lt 8 -and $t -match 'BulkReg\s+([0-9]+(\.[0-9]+)+)') { $ver = $Matches[1] }
        if ($t -eq '' -or $t -match '^[#;\[]') { continue }
        $p = $t.IndexOf('=')
        if ($p -lt 1) { continue }
        $k = $t.Substring(0, $p).Trim()
        $lk = $k.ToLowerInvariant()
        if ($map.Contains($lk)) { $dups.Add($k) }
        $map[$lk] = [pscustomobject]@{ Key = $k; Value = $t.Substring($p + 1).Trim(); Line = $i }
    }
    [pscustomobject]@{ Path = $Path; Lines = $lines; Map = $map; Dups = @($dups); Version = $ver }
}

# "# [since 4.3.0] Key, Key" / "# [removed 3.9.2] Key" lines of the template -> lower-case key -> Kind, Ver
function Read-KeyHistory([string]$Path) {
    $h = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $h }
    foreach ($l in (Get-Content -LiteralPath $Path -Encoding UTF8)) {
        if ($l -match '^\s*#\s*\[(since|removed)\s+([0-9]+(?:\.[0-9]+)+)\]\s*(.+?)\s*$') {
            $kind = $Matches[1]; $ver = $Matches[2]
            foreach ($k in ($Matches[3] -split '\s*,\s*')) {
                if ($k) { $h[$k.ToLowerInvariant()] = [pscustomobject]@{ Kind = $kind; Ver = $ver } }
            }
        }
    }
    return $h
}

# The comment lines directly above a key line of the template (a blank line, another key or a section banner ends them)
function Get-KeyComment([string[]]$Lines, [int]$Idx) {
    $c = New-Object System.Collections.Generic.List[string]
    for ($j = $Idx - 1; $j -ge 0; $j--) {
        $t = $Lines[$j].Trim()
        if ($t -notmatch '^#') { break }
        if ($t -match '^#\s*[-=]{5,}') { break }
        if ($t -match '^#\s*\[(since|removed)\s+[0-9]') { break }
        $c.Insert(0, $Lines[$j].TrimEnd())
    }
    return $c.ToArray()
}

function Get-IniRows([object]$Mine, [object]$Other, [hashtable]$Hist) {
    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($lk in $Other.Map.Keys) {
        $o = $Other.Map[$lk]
        $since = if ($Hist.ContainsKey($lk) -and $Hist[$lk].Kind -eq 'since') { $Hist[$lk].Ver } else { '' }
        if ($Mine.Map.Contains($lk)) {
            $m = $Mine.Map[$lk]
            $st = if ($m.Value -ieq $o.Value) { 'SAME' } else { 'DIFFERENT' }
            if ($m.Value -match '<[^>]+>') { $st = 'PLACEHOLDER' }
            $rows.Add([pscustomobject]@{ Status = $st; Key = $o.Key; Since = $since; Yours = $m.Value; Template = $o.Value; Line = $m.Line + 1 })
        } else {
            $rows.Add([pscustomobject]@{ Status = 'MISSING'; Key = $o.Key; Since = $since; Yours = ''; Template = $o.Value; Line = '' })
        }
    }
    foreach ($lk in $Mine.Map.Keys) {
        if ($Other.Map.Contains($lk)) { continue }
        $m = $Mine.Map[$lk]
        $st = if ($Hist.ContainsKey($lk) -and $Hist[$lk].Kind -eq 'removed') { 'RETIRED' } else { 'UNKNOWN' }
        $since = if ($st -eq 'RETIRED') { 'removed ' + $Hist[$lk].Ver } else { '' }
        $rows.Add([pscustomobject]@{ Status = $st; Key = $m.Key; Since = $since; Yours = $m.Value; Template = ''; Line = $m.Line + 1 })
    }
    foreach ($d in $Mine.Dups) { $rows.Add([pscustomobject]@{ Status = 'DUPLICATE'; Key = $d; Since = ''; Yours = $Mine.Map[$d.ToLowerInvariant()].Value; Template = ''; Line = $Mine.Map[$d.ToLowerInvariant()].Line + 1 }) }
    return , $rows
}

function Sort-BySince($Rows) {
    # newest release first, keys without a release last
    $Rows | Sort-Object @{ Expression = { if ($_.Since -match '^[0-9]') { [version]$_.Since } else { [version]'0.0' } }; Descending = $true }, Key
}

function Invoke-IniCompare {
    $shipped = Join-Path $KitConfig 'bulkreg.ini'
    $otherPath = if ($Arg) { $Arg } elseif ($Template) { $Template } else { $shipped }
    $mine = Read-Ini $Config
    $other = Read-Ini $otherPath
    $hist = Read-KeyHistory $shipped
    $rows = Get-IniRows $mine $other $hist
    Write-Host "Yours   : $Config   (release in header: $(if ($mine.Version) { $mine.Version } else { 'unknown' }))"
    Write-Host "Compared: $otherPath   (release in header: $(if ($other.Version) { $other.Version } else { 'unknown' }))"
    if (-not (Test-Path -LiteralPath $shipped)) { Warn "kit template $shipped not found: no release information (KEY HISTORY)" }
    foreach ($s in 'MISSING', 'UNKNOWN', 'RETIRED', 'DUPLICATE', 'PLACEHOLDER', 'DIFFERENT') {
        $sel = @($rows | Where-Object { $_.Status -eq $s })
        $title = switch ($s) {
            'MISSING'     { 'MISSING in your ini - IniUpgrade adds them with the template value' }
            'UNKNOWN'     { 'NOT in the compared file - typo, customer-specific or removed long ago (nothing reads a misspelled key)' }
            'RETIRED'     { 'RETIRED keys - no longer used, safe to delete' }
            'DUPLICATE'   { 'DUPLICATE keys - the LAST one in the file wins in the agents' }
            'PLACEHOLDER' { 'PLACEHOLDER still in your values - replace before a live run' }
            'DIFFERENT'   { 'DIFFERENT from the compared value (informational: your value wins)' }
        }
        Write-Host ''
        Write-Host ("== {0} ({1})" -f $title, $sel.Count)
        if ($sel.Count -eq 0) { continue }
        if ($s -eq 'MISSING') { Sort-BySince $sel | Format-Table Since, Key, @{ n = 'Template value'; e = { $_.Template } } -AutoSize }
        elseif ($s -in 'DIFFERENT', 'PLACEHOLDER') { $sel | Format-Table Line, Key, Yours, @{ n = 'Compared'; e = { $_.Template } } -AutoSize -Wrap }
        else { $sel | Format-Table Line, Key, Yours, Since -AutoSize -Wrap }
    }
    $same = @($rows | Where-Object { $_.Status -eq 'SAME' }).Count
    Write-Host ''
    Write-Host ("{0} key(s) identical." -f $same)
    $miss = @($rows | Where-Object { $_.Status -eq 'MISSING' }).Count
    if ($miss -gt 0) { Warn "$miss key(s) missing: run  bulkreg.cmd IniUpgrade  (preview) and  IniUpgrade -Yes" } else { Pass 'no key missing' }
    if (@($rows | Where-Object { $_.Status -eq 'PLACEHOLDER' }).Count -gt 0) { Warn 'unreplaced <PLACEHOLDER> values' }
    if ($Out) {
        $rows | Export-Csv -LiteralPath $Out -NoTypeInformation -Encoding UTF8
        Write-Host "Written: $Out"
    }
    Show-Summary
}

function Invoke-IniUpgrade {
    $tplPath = if ($Template) { $Template } else { Join-Path $KitConfig 'bulkreg.ini' }
    if (-not (Test-Path -LiteralPath $tplPath)) { throw "template not found: $tplPath (use -Template <file>)" }
    if ((Resolve-Path -LiteralPath $tplPath).Path -eq (Resolve-Path -LiteralPath $Config).Path) { throw 'the template and your bulkreg.ini are the same file' }
    $tpl = Read-Ini $tplPath
    $mine = Read-Ini $Config
    $hist = Read-KeyHistory $tplPath
    $today = Get-Date -Format 'yyyy-MM-dd'
    $inserts = @{}                    # index of YOUR line (-1 = end of file) -> lines to add after it
    $added = New-Object System.Collections.Generic.List[object]
    $anchor = -1
    foreach ($lk in $tpl.Map.Keys) {
        if ($mine.Map.Contains($lk)) { $anchor = $mine.Map[$lk].Line; continue }
        $item = $tpl.Map[$lk]
        $since = if ($hist.ContainsKey($lk) -and $hist[$lk].Kind -eq 'since') { $hist[$lk].Ver } else { '' }
        $block = New-Object System.Collections.Generic.List[string]
        $cmt = @(Get-KeyComment $tpl.Lines $item.Line)
        if ($cmt.Count -gt 0) { $block.Add('') }
        $block.Add("# [IniUpgrade $today] added" + $(if ($since) { " - new in $since" } else { '' }))
        foreach ($c in $cmt) { $block.Add($c) }
        $block.Add("$($item.Key)=$($item.Value)")
        if (-not $inserts.ContainsKey($anchor)) { $inserts[$anchor] = New-Object System.Collections.Generic.List[string] }
        foreach ($b in $block) { $inserts[$anchor].Add($b) }
        $added.Add([pscustomobject]@{ Since = $since; Key = $item.Key; Value = $item.Value; After = $(if ($anchor -ge 0) { ($mine.Lines[$anchor]).Trim() } else { '(end of file)' }) })
    }
    Write-Host "Your ini : $Config   (release in header: $(if ($mine.Version) { $mine.Version } else { 'unknown' }))"
    Write-Host "Template : $tplPath   (release in header: $(if ($tpl.Version) { $tpl.Version } else { 'unknown' }))"
    if ($mine.Dups.Count -gt 0) { Warn "duplicate keys in your ini (the last one wins): $($mine.Dups -join ', ') - not changed" }
    if ($added.Count -eq 0) { Pass 'nothing to add: every key of the template is already in your bulkreg.ini'; Show-Summary; return }
    Write-Host ''
    Write-Host ("{0} key(s) missing in your ini:" -f $added.Count)
    Sort-BySince $added | Format-Table Since, Key, Value, @{ n = 'Inserted after'; e = { $_.After } } -AutoSize -Wrap
    $needs = @($added | Where-Object { $_.Value -match '<[^>]+>' })
    foreach ($n in $needs) { Warn "$($n.Key)=$($n.Value) is a <PLACEHOLDER>: set a real value after the upgrade" }
    if (-not $Yes) {
        Write-Host 'PREVIEW only - nothing was changed. Run again with -Yes to add these keys (a backup is made first).'
        Show-Summary
        return
    }

    $new = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $mine.Lines.Count; $i++) {
        $new.Add($mine.Lines[$i])
        if ($inserts.ContainsKey($i)) { foreach ($x in $inserts[$i]) { $new.Add($x) } }
    }
    if ($inserts.ContainsKey(-1)) {
        $new.Add('')
        $new.Add("# ---------- added by IniUpgrade $today (no earlier key of the template was found in this file) ----------")
        foreach ($x in $inserts[-1]) { $new.Add($x) }
    }
    if ($tpl.Version -and $mine.Version -and $tpl.Version -ne $mine.Version) {
        for ($i = 0; $i -lt [Math]::Min(8, $new.Count); $i++) {
            if ($new[$i] -match 'BulkReg\s+[0-9]+(\.[0-9]+)+') { $new[$i] = ([regex]'BulkReg\s+[0-9]+(\.[0-9]+)+').Replace($new[$i], "BulkReg $($tpl.Version)", 1); break }
        }
    }
    $bak = "$Config.bak.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item -LiteralPath $Config -Destination $bak
    Set-Content -LiteralPath $Config -Value $new -Encoding UTF8
    Write-Action "IniUpgrade $Config from $tplPath: $($added.Count) key(s) added; backup $bak"

    # verify: every key of the template is there now and none of YOUR values changed
    $chk = Read-Ini $Config
    $bad = 0
    foreach ($lk in $tpl.Map.Keys) { if (-not $chk.Map.Contains($lk)) { Fail "after the upgrade $($tpl.Map[$lk].Key) is still missing"; $bad++ } }
    foreach ($lk in $mine.Map.Keys) {
        if (-not $chk.Map.Contains($lk)) { Fail "after the upgrade your key $($mine.Map[$lk].Key) is gone"; $bad++ }
        elseif ($chk.Map[$lk].Value -cne $mine.Map[$lk].Value) { Fail "your value of $($mine.Map[$lk].Key) changed"; $bad++ }
    }
    if ($bad -eq 0) { Pass "$($added.Count) key(s) added; all your $($mine.Map.Count) values are unchanged" }
    else { Warn "restore the backup:  Copy-Item '$bak' '$Config' -Force" }
    Write-Host "Backup: $bak"
    Write-Host 'Added lines (diff against the backup):'
    Compare-Object (Get-Content -LiteralPath $bak) (Get-Content -LiteralPath $Config) | ForEach-Object { "  {0} {1}" -f $(if ($_.SideIndicator -eq '=>') { '+' } else { '-' }), $_.InputObject }
    Show-Summary
}

switch ($Command) {
    'IniCompare'   { Invoke-IniCompare }
    'IniUpgrade'   { Invoke-IniUpgrade }
    'Help'         { Show-Help }
    'Init'         { Invoke-Init }
    'Check'        { Invoke-Check }
    'DryRun'       { switch ($Arg) { 'On' { Set-Cfg 'DryRun' '1' } 'Off' { Set-Cfg 'DryRun' '0' } default { throw 'usage: DryRun On|Off' } } }
    'Batches'      { Show-Batches }
    'Status'       { Show-Status $Arg }
    'Tail'         { Show-Tail }
    'Stop'         { $sf = Join-Path (Get-CfgDir 'BatchDir' 'batches') 'STOP.txt'; New-Item -ItemType File -Force -Path $sf | Out-Null; Write-Action "Stop: created $sf"; Write-Host "STOP.txt created: a chunked 03 run stops cleanly at the end of its current chunk. 'Unstop' removes it." }
    'Unstop'       { $sf = Join-Path (Get-CfgDir 'BatchDir' 'batches') 'STOP.txt'; if (Test-Path -LiteralPath $sf) { Remove-Item -LiteralPath $sf; Write-Action "Unstop: removed $sf"; Write-Host 'STOP.txt removed.' } else { Write-Host 'No STOP.txt.' } }
    'PurgeSecrets' { Remove-Secrets }
    'Versions'     { Test-Versions }
}
