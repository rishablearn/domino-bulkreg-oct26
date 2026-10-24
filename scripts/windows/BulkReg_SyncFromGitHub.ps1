<#
.SYNOPSIS
  Brings the BulkReg kit folder up to date from GitHub (Windows PowerShell 5.1 or later). Never overwrites local work.

.DESCRIPTION
  1. Finds the kit repo (the folder above scripts\windows) and checks remote, branch and git.
  2. Refuses to continue when tracked files have local changes (use -Stash to set them aside and bring them back).
  3. git fetch, then shows the incoming commits and files.
  4. Asks, then runs  git pull --ff-only  (no merge commit, no overwrite; stops if the histories diverged).
  5. Tells you what to do next: which LotusScript libraries changed and must be pasted into Designer again.
  It only touches the kit folder. It never reads or changes C:\BulkReg (config, batches, secure, ids, audit).
  It does not change bulkreg.nsf: pasting the changed .lss files into Designer stays a manual step.

.PARAMETER DryRun  Fetch and show what would change; change nothing.
.PARAMETER Yes     Do not ask before pulling.
.PARAMETER Stash   Stash local changes first and restore them after the pull.
.PARAMETER Remote  Remote name (default origin).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\BulkReg_SyncFromGitHub.ps1 -DryRun
  powershell -ExecutionPolicy Bypass -File .\BulkReg_SyncFromGitHub.ps1
  Not run by its author on Windows: try -DryRun first.
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Yes,
    [switch]$Stash,
    [string]$Remote = 'origin'
)
Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

function Say($m)  { Write-Host ""; Write-Host "== $m" -ForegroundColor Cyan }
function Stop-Run($m) { Write-Host "STOP: $m" -ForegroundColor Red; exit 1 }
function Git { & git @args; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed (exit $LASTEXITCODE)" } }
function GitOut { $o = & git @args 2>&1; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed: $o" }; $o }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Stop-Run 'git is not installed (https://git-scm.com/download/win).' }
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $root
try { $null = GitOut rev-parse --is-inside-work-tree } catch { Stop-Run "$root is not a git repository. Clone it first: git clone https://github.com/<org-or-user>/<repo>.git" }
try { $url = (GitOut remote get-url $Remote | Out-String).Trim() } catch { Stop-Run "No git remote '$Remote'. Add it: git remote add origin https://github.com/<org-or-user>/<repo>.git" }
$branch = (GitOut branch --show-current | Out-String).Trim()
if (-not $branch) { Stop-Run 'Detached HEAD: check out a branch first (git switch main).' }

$gitDir = (GitOut rev-parse --git-dir | Out-String).Trim()
$lock = Join-Path $gitDir 'index.lock'
if (Test-Path $lock) {
    if (Get-Process git -ErrorAction SilentlyContinue) { Stop-Run "A git process is running, so $lock may be in use. Wait, then run again." }
    $a = Read-Host "Found $lock and no git process is running (leftover of an interrupted command). Delete it? [y/N]"
    if ($a -match '^(y|yes)$') { Remove-Item -LiteralPath $lock -Force; Write-Host "Removed $lock" } else { Stop-Run "Lock kept. Delete it yourself and run again." }
}

Say "Kit folder: $root"
Say "Remote: $Remote -> $url   Branch: $branch"

# local changes to tracked files would be in the way
$dirty = (GitOut status --porcelain --untracked-files=no | Out-String).Trim()
if ($dirty) {
    Write-Host $dirty
    if (-not $Stash) { Stop-Run 'Tracked files have local changes (listed above). Commit them, or run again with -Stash.' }
}

Say 'Fetching'
Git fetch $Remote $branch
$upstream = "$Remote/$branch"
$ahead  = [int]((GitOut rev-list --count "$upstream..HEAD" | Out-String).Trim())
$behind = [int]((GitOut rev-list --count "HEAD..$upstream" | Out-String).Trim())
Write-Host "Local commits not on GitHub: $ahead   GitHub commits not here: $behind"

if ($behind -eq 0) { Say 'Already up to date.'; if ($ahead -gt 0) { Write-Host "You have $ahead local commit(s) to push (use scripts/mac/sync_to_github.sh or git push)." }; exit 0 }
if ($ahead -gt 0) { Stop-Run "Local and GitHub history have both moved ($ahead local, $behind remote). A safe fast-forward is not possible. Ask the repo owner, or use git pull --rebase yourself." }

Say 'Incoming commits'
Git log --oneline "HEAD..$upstream"
Say 'Incoming files'
$files = @(GitOut diff --name-status "HEAD..$upstream")
$files | ForEach-Object { Write-Host $_ }

if ($DryRun) { Say 'Dry run finished: nothing was changed.'; exit 0 }

if (-not $Yes) {
    $a = Read-Host "Pull these $behind commit(s) into $root ? [y/N]"
    if ($a -notmatch '^(y|yes)$') { Write-Host 'Cancelled. Nothing was changed.'; exit 0 }
}

$stashed = $false
if ($dirty -and $Stash) { Say 'Stashing local changes'; Git stash push -m "BulkReg sync $(Get-Date -Format s)"; $stashed = $true }
try {
    Say 'Pulling (fast-forward only)'
    Git pull --ff-only $Remote $branch
} finally {
    if ($stashed) { Say 'Restoring local changes'; & git stash pop; if ($LASTEXITCODE -ne 0) { Write-Host 'Stash could not be restored cleanly: run  git stash list  and resolve by hand.' -ForegroundColor Yellow } }
}

Say "Done: now at $((GitOut rev-parse --short HEAD | Out-String).Trim())"
$names = @($files | ForEach-Object { ($_ -split "`t")[-1] })
$libs = @($names | Where-Object { $_ -like 'lotusscript/*' -or $_ -like 'lotusscript\*' })
if ($libs.Count -gt 0) {
    Write-Host 'NEXT STEP - paste these into Designer (library or agent), save, sign, Tools > Recompile All LotusScript:' -ForegroundColor Yellow
    $libs | ForEach-Object { Write-Host "  $_" }
    Write-Host 'Order: BulkRegCommon, BulkRegAgents, BulkRegRecover, then changed agents. Keep DryRun=1 until checked.'
} else {
    Write-Host 'No LotusScript files changed: nothing to paste into Designer.'
}
if ($names -contains 'config/bulkreg.ini') { Write-Host 'config\bulkreg.ini (the template) changed: run  scripts\windows\bulkreg.cmd IniCompare  then  IniUpgrade -Yes  for your own bulkreg.ini.' -ForegroundColor Yellow }
