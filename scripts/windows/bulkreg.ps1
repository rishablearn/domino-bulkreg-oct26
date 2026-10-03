<#
=====================================================================
 bulkreg.ps1  -  BulkReg 1.1 admin tool for Windows
                 (Domino Administrator workstation or Windows Domino server)

 Prepares folders and NTFS permissions, validates the config, arms/disarms
 headless runs, prints the Domino console commands, summarises audit CSVs,
 follows logs and securely removes temporary secrets.

 The registration itself runs INSIDE Notes/Domino (agents in bulkreg.nsf).
 This script never registers users and never touches names.nsf.

 Usage:  .\bulkreg.ps1 <Command> [options]        (.\bulkreg.ps1 Help)
         or bulkreg.cmd <Command> [options]
 Every state-changing command is written to <AuditDir>\bulkreg_admin_actions.log
=====================================================================
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Help', 'Init', 'Check', 'Console', 'Run', 'Arm', 'Disarm', 'ConfirmToday', 'DryRun', 'Status', 'Tail', 'PurgeSecrets')]
    [string]$Command = 'Help',
    [Parameter(Position = 1)] [string]$Arg,
    [string]$Base = $(if ($env:BULKREG_BASE) { $env:BULKREG_BASE } else { 'C:\BulkReg' }),
    [string]$Config,
    [string]$ServiceAccount,          # Windows account running the Domino server (server mode)
    [string]$Db = 'bulkreg.nsf',
    [switch]$IncludeIds,
    [switch]$Yes
)
Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
$Version = '1.1.0'
if (-not $Config) { $Config = if ($env:BULKREG_CONFIG) { $env:BULKREG_CONFIG } else { Join-Path $Base 'config\bulkreg.ini' } }
$KitConfig = Join-Path $PSScriptRoot '..\..\config'
$Agents = [ordered]@{
    '01' = '01 | Preflight Check'
    '02' = '02 | Export to Registration Text File'
    '03' = '03 | Bulk Register (ID Vault)'
    '04' = '04 | Verify Registration + Vault'
}
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

# Restrict a folder to Administrators + SYSTEM + current user (+ Domino service account)
function Set-RestrictedAcl([string]$Path) {
    $who = @('*S-1-5-32-544:(OI)(CI)F', '*S-1-5-18:(OI)(CI)F', "${env:USERDOMAIN}\${env:USERNAME}:(OI)(CI)F")
    if ($ServiceAccount) { $who += "${ServiceAccount}:(OI)(CI)M" }
    & icacls $Path /inheritance:r /grant:r @who | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "icacls failed for $Path" }
}

# ---------- commands ----------
function Show-Help {
@"
bulkreg.ps1 $Version - BulkReg admin tool for Windows
Base=$Base  Config=$Config

  Init [-ServiceAccount DOMAIN\svc]   Create $Base\{config,ids,secure,audit,cert}, restrict ACLs,
                                      install config templates if missing (run as Administrator)
  Check                               Validate folders, ACLs, config values and prerequisites
  Console                             Print the Domino console commands (server mode)
  Run 01|02|03|04                     Print (or send via BULKREG_CONSOLE_CMD) 'tell amgr run'
  Arm | Disarm                        ServerRunEnabled=1 / 0 (headless kill switch)
  ConfirmToday                        ServerConfirm=REGISTER-<today> (LIVE headless run)
  DryRun On|Off                       DryRun=1 / 0
  Status [audit.csv]                  Summarise an audit CSV by Result (default: newest)
  Tail                                Follow the newest debug log
  PurgeSecrets [-IncludeIds] [-Yes]   List (default) or delete password/text files (and ID files)

Interactive use on the Domino Administrator client needs no console: run the agents
from bulkreg.nsf > Actions.
"@ | Write-Host
}

function Invoke-Init {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) { throw 'Init must run in an elevated PowerShell (Run as Administrator).' }
    foreach ($d in 'config', 'ids', 'secure', 'audit', 'cert') { New-Item -ItemType Directory -Force -Path (Join-Path $Base $d) | Out-Null }
    foreach ($d in 'ids', 'secure', 'cert') { Set-RestrictedAcl (Join-Path $Base $d) }
    $cfgDst = Join-Path $Base 'config\bulkreg.ini'
    if (-not (Test-Path $cfgDst) -and (Test-Path (Join-Path $KitConfig 'bulkreg.ini'))) {
        Copy-Item (Join-Path $KitConfig 'bulkreg.ini') $cfgDst; Write-Host "Installed config template -> $cfgDst"
    }
    $mapDst = Join-Path $Base 'config\server_mapping.csv'
    if (-not (Test-Path $mapDst) -and (Test-Path (Join-Path $KitConfig 'server_mapping.csv'))) {
        Copy-Item (Join-Path $KitConfig 'server_mapping.csv') $mapDst; Write-Host "Installed mapping template -> $mapDst"
    }
    Get-ChildItem $Base | Format-Table Name, LastWriteTime -AutoSize
    $script:Config = $cfgDst; Write-Action "Init base=$Base serviceAccount=$ServiceAccount"
    Write-Host "Next: edit $cfgDst, then: .\bulkreg.ps1 Check"
}

function Test-RestrictedAcl([string]$Path) {
    if (-not (Test-Path $Path)) { Fail "missing folder $Path"; return }
    $acl = Get-Acl $Path
    if (-not $acl.AreAccessRulesProtected) { Warn "$Path inherits permissions (run Init to restrict)"; }
    $wide = $acl.Access | Where-Object { $_.IdentityReference -match 'Everyone|\\Users$|Authenticated Users' }
    if ($wide) { Fail "$Path grants access to $(($wide.IdentityReference | Select-Object -Unique) -join ', ')" } else { Pass "$Path restricted" }
}

function Invoke-Check {
    Write-Host '== Files and permissions'
    if (Test-Path $Config) { Pass "config $Config" } else { Fail "config $Config not found"; return Show-Summary }
    Test-RestrictedAcl (Get-CfgDir 'IDFileDir' 'ids')
    Test-RestrictedAcl (Get-CfgDir 'PasswordDir' 'secure')
    $audit = Get-CfgDir 'AuditDir' 'audit'
    if (Test-Path $audit) { Pass "audit folder $audit" } else { Fail "audit folder $audit missing" }
    $map = Get-Cfg 'MappingFile' (Join-Path $Base 'config\server_mapping.csv')
    if (Test-Path $map) { Pass "mapping $map" } else { Fail "mapping $map not found" }

    Write-Host '== Config values'
    $ph = Select-String -LiteralPath $Config -Pattern '<[^>]+>' | Where-Object { $_.Line -notmatch '^\s*#' }
    if ($ph) { Fail "unreplaced <PLACEHOLDER> on line(s) $(($ph.LineNumber) -join ', ')" } else { Pass 'no <PLACEHOLDER> values left' }
    if ((Select-String -LiteralPath $Config -Pattern '^\s*\w+=\s*/' -Quiet)) { Warn 'Linux-style absolute paths found - use Windows paths on this machine' }
    if ((Get-Cfg 'UseCA' '1') -eq '1') { Pass 'UseCA=1' } else { Warn 'UseCA=0: interactive (client) mode only - server mode needs UseCA=1' }
    if ((Get-Cfg 'DryRun' '1') -eq '1') { Pass 'DryRun=1 (safe)' } else { Warn 'DryRun=0 - LIVE mode' }
    if ((Get-Cfg 'ServerRunEnabled' '0') -eq '1') { Warn 'ServerRunEnabled=1 (armed)' } else { Pass 'ServerRunEnabled=0 (disarmed)' }
    $tok = Get-Cfg 'ServerConfirm'
    if ($tok -and $tok -ne "REGISTER-$(Get-Date -Format yyyyMMdd)") { Warn "ServerConfirm=$tok is not today's token" }
    if (Get-Cfg 'DefaultPolicy') { Pass 'DefaultPolicy set' } else { Warn 'DefaultPolicy empty' }
    if (Get-Cfg 'VaultServer') { Pass 'VaultServer set' } else { Warn 'VaultServer empty - no vault verification' }

    Write-Host '== Windows prerequisites'
    $nserver = Get-Process -Name nserver -ErrorAction SilentlyContinue
    $nlnotes = Get-Process -Name nlnotes, notes2, notes -ErrorAction SilentlyContinue
    if ($nserver) { Pass 'Domino server process (nserver) running on this machine - server mode possible' }
    elseif ($nlnotes) { Pass 'Notes / Domino Administrator client running - interactive mode' }
    else { Warn 'neither Domino server nor Notes client process found' }
    Pass "time zone: $((Get-TimeZone).Id) (ServerConfirm uses the Domino server date)"
    Show-Summary
}
function Show-Summary { Write-Host "`nResult: $script:Fails fail(s), $script:Warns warning(s)" }

function Show-Console {
    Write-Host '# Server mode only - enter on the Domino server console:'
    Write-Host "set config BulkRegConfigPath=$Config"
    foreach ($k in $Agents.Keys) { Write-Host ("tell amgr run `"{0}`" '{1}'" -f $Db, $Agents[$k]) }
}

function Invoke-Run([string]$Key) {
    if (-not $Agents.Contains($Key)) { throw 'usage: Run 01|02|03|04' }
    $c = "tell amgr run `"$Db`" '$($Agents[$Key])'"
    if ((Get-Cfg 'ServerRunEnabled' '0') -ne '1') { Warn 'ServerRunEnabled=0 - the server agent will refuse to run (use: Arm)' }
    if ($Key -eq '03' -and (Get-Cfg 'DryRun' '1') -eq '0' -and (Get-Cfg 'ServerConfirm') -ne "REGISTER-$(Get-Date -Format yyyyMMdd)") {
        Warn "LIVE run without today's ServerConfirm token - Agent 03 will refuse (use: ConfirmToday)"
    }
    Write-Action "Run $Key"
    if ($env:BULKREG_CONSOLE_CMD) { Write-Host "Sending via BULKREG_CONSOLE_CMD: $c"; & $env:BULKREG_CONSOLE_CMD $c }
    else {
        Write-Host "Enter on the Domino server console:`n  $c"
        Write-Host '(Interactive alternative: open bulkreg.nsf in the Domino Administrator client > Actions.)'
    }
}

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
    'Console'      { Show-Console }
    'Run'          { Invoke-Run $Arg }
    'Arm'          { Set-Cfg 'ServerRunEnabled' '1' }
    'Disarm'       { Set-Cfg 'ServerRunEnabled' '0' }
    'ConfirmToday' { Set-Cfg 'ServerConfirm' "REGISTER-$(Get-Date -Format yyyyMMdd)" }
    'DryRun'       { switch ($Arg) { 'On' { Set-Cfg 'DryRun' '1' } 'Off' { Set-Cfg 'DryRun' '0' } default { throw 'usage: DryRun On|Off' } } }
    'Status'       { Show-Status $Arg }
    'Tail'         { Show-Tail }
    'PurgeSecrets' { Remove-Secrets }
}
