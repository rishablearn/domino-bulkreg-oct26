<#
.SYNOPSIS
  Records the handle count and memory of the Notes client while a BulkReg agent runs (read-only evidence for
  "too many handles" / "maximum number of memory segments" problems).
.DESCRIPTION
  Start it BEFORE the agent, leave it running, press Ctrl+C when the session ends:
    powershell -ExecutionPolicy Bypass -File .\BulkReg_WatchNotes.ps1
  Every 30 s it appends  Time,Handles,Threads,WorkingSetMB,PrivateMB  to notes_watch_<time>.csv. At Ctrl+C it prints
  the change per hour. Compare the timestamps with RECOVER_<run>_timing.csv (or the audit CSV): if Handles climb steadily
  with every mail file, the client leaks and the sessions must stay short; if they stay flat, the problem is elsewhere.
  Note: Windows "Handles" counts operating system handles of the process. The Notes-internal handle table named in the
  NSD message is not visible here: send the NSD and this CSV to HCL support together.
  Not run by its author on Windows.
.PARAMETER Name         Process name without .exe (default nlnotes)
.PARAMETER IntervalSec  Seconds between samples (default 30)
.PARAMETER Out          Output CSV
#>
param(
    [string]$Name = 'nlnotes',
    [int]$IntervalSec = 30,
    [string]$Out = ("notes_watch_{0}.csv" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
)
$ErrorActionPreference = 'Stop'
"Time,Handles,Threads,WorkingSetMB,PrivateMB" | Out-File -LiteralPath $Out -Encoding utf8
Write-Host "Watching '$Name' every $IntervalSec s -> $Out   (Ctrl+C to stop)"
$first = $null; $last = $null
try {
    while ($true) {
        $p = Get-Process -Name $Name -ErrorAction SilentlyContinue | Sort-Object Handles -Descending | Select-Object -First 1
        if ($p) {
            $row = [pscustomobject]@{ Time = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'); Handles = $p.Handles; Threads = $p.Threads.Count; WS = [math]::Round($p.WorkingSet64 / 1MB, 0); PM = [math]::Round($p.PrivateMemorySize64 / 1MB, 0) }
            if (-not $first) { $first = $row }; $last = $row
            ('{0},{1},{2},{3},{4}' -f $row.Time, $row.Handles, $row.Threads, $row.WS, $row.PM) | Add-Content -LiteralPath $Out -Encoding utf8
            Write-Host ("{0}  handles={1}  threads={2}  ws={3} MB  private={4} MB" -f $row.Time, $row.Handles, $row.Threads, $row.WS, $row.PM)
        } else { Write-Host "$(Get-Date -Format 'HH:mm:ss')  process '$Name' not running" }
        Start-Sleep -Seconds $IntervalSec
    }
} finally {
    if ($first -and $last -and $first.Time -ne $last.Time) {
        $hrs = ([datetime]$last.Time - [datetime]$first.Time).TotalHours
        if ($hrs -gt 0) {
            Write-Host ""
            Write-Host ("Observed {0:N1} h: handles {1} -> {2} ({3:N0} per hour), private memory {4} -> {5} MB" -f $hrs, $first.Handles, $last.Handles, (($last.Handles - $first.Handles) / $hrs), $first.PM, $last.PM)
        }
    }
    Write-Host "Saved $Out"
}
