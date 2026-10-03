<#
=====================================================================
 bulkreg.ps1  -  BulkReg 1.2 OPTIONAL helper for the Windows admin workstation
                 (the machine running the HCL Domino Administrator client)

 Registration runs entirely inside the Domino Administrator client
 (agents in bulkreg.nsf > Actions). This script never registers users and
 never touches names.nsf. It only automates the Windows chores around a run:

   Init          create C:\BulkReg\{config,ids,secure,audit,cert}, lock down
                 ids / secure / cert, copy the config templates
   Check         validate folders, ACLs and config values before a run
   DryRun On|Off flip DryRun in bulkreg.ini (backup + diff)
   Status        summarise the newest (or a given) audit CSV
   Tail          follow the newest debug log while an agent runs
   PurgeSecrets  list / delete initial-password files, text files, local IDs

 Usage:  .\bulkreg.cmd <Command> [options]        (.\bulkreg.cmd Help)
 Every state-changing command is written to <AuditDir>\bulkreg_admin_actions.log
=====================================================================
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Help', 'Init', 'Check', 'DryRun', 'Status', 'Tail', 'PurgeSecrets')]
    [string]$Command = 'Help',
    [Parameter(Position = 1)] [string]$Arg,
    [string]$Base = $(if ($env:BULKREG_BASE) { $env:BULKREG_BASE } else { 'C:\BulkReg' }),
    [string]$Config,
    [switch]$IncludeIds,
    [switch]$Yes
)
Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
$Version = '1.2.0'
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
    Get-ChildItem -Path (Get-CfgDir 'AuditDir' 'audit') -Filter $Pattern -File -ErrorAction SilentlyContinue |
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

  Init                               Create $Base\{config,ids,secure,audit,cert}, restrict ids/secure/cert,
                                     copy config templates if missing (run as Administrator)
  Check                              Validate folders, ACLs and config values
  DryRun On|Off                      Set DryRun=1 / 0 in bulkreg.ini (backup + diff)
  Status [audit.csv]                 Summarise an audit CSV by Result (default: newest)
  Tail                               Follow the newest debug log
  PurgeSecrets [-IncludeIds] [-Yes]  List (default) or delete password/text files (and local ID files)

The agents themselves are run from bulkreg.nsf > Actions in the Domino Administrator client.
"@ | Write-Host
}

function Invoke-Init {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) { throw 'Init must run in an elevated PowerShell (Run as Administrator).' }
    foreach ($d in 'config', 'ids', 'secure', 'audit', 'cert') { New-Item -ItemType Directory -Force -Path (Join-Path $Base $d) | Out-Null }
    foreach ($d in 'ids', 'secure', 'cert') { Set-RestrictedAcl (Join-Path $Base $d) }
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
    if ((Get-Cfg 'DryRun' '1') -eq '1') { Pass 'DryRun=1 (safe)' } else { Warn 'DryRun=0 - LIVE mode' }
    if (Get-Cfg 'DefaultPolicy') { Pass 'DefaultPolicy set' } else { Warn 'DefaultPolicy empty - make sure a policy assigns the ID Vault' }
    if (Get-Cfg 'VaultServer') { Pass 'VaultServer set' } else { Warn 'VaultServer empty - no vault verification' }

    Write-Host '== Workstation'
    if (Get-Process -Name nlnotes, notes2, notes -ErrorAction SilentlyContinue) { Pass 'Notes / Domino Administrator client is running' }
    else { Warn 'Domino Administrator client not running (start it before running the agents)' }
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
    $bad = $rows | Where-Object { $_.Result -match '^(FAIL|ERROR|CHECK_ERROR)' -or $_.Result -match 'PENDING' }
    if ($bad) { Write-Host 'Needs attention (first 15):'; $bad | Select-Object -First 15 Result, FullNameBefore, Message | Format-Table -AutoSize -Wrap }
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

switch ($Command) {
    'Help'         { Show-Help }
    'Init'         { Invoke-Init }
    'Check'        { Invoke-Check }
    'DryRun'       { switch ($Arg) { 'On' { Set-Cfg 'DryRun' '1' } 'Off' { Set-Cfg 'DryRun' '0' } default { throw 'usage: DryRun On|Off' } } }
    'Status'       { Show-Status $Arg }
    'Tail'         { Show-Tail }
    'PurgeSecrets' { Remove-Secrets }
}
