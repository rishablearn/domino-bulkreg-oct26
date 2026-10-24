<#
.SYNOPSIS
  Lists the mail files of THIS Windows Domino server for BulkReg agent 13 - Recover Users (read-only).
.DESCRIPTION
  Run on each Windows mail server:
    powershell -ExecutionPolicy Bypass -File .\BulkReg_ListMailFiles.ps1 -DataDir D:\Domino\Data -Server "DominoADMail2/Demo"
  Writes  maillist_<server>_<time>.csv  (UTF-8, columns Server,Path,Bytes,Modified; Path relative to the data directory).
  Copy it to the machine that runs BulkReg, into its MailListDir (default C:\BulkReg\maillists\).
  Covers the folder "mail" and "mail<number>". Other folders: -Folders mail,mail1,hr
  Not run by its author on Windows.
#>
param(
    [Parameter(Mandatory)] [string]$DataDir,
    [Parameter(Mandatory)] [string]$Server,
    [string]$Out,
    [string[]]$Folders
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $DataDir -PathType Container)) { throw "Data directory not found: $DataDir" }
$DataDir = (Resolve-Path -LiteralPath $DataDir).Path.TrimEnd('\')
if (-not $Out) { $Out = "maillist_{0}_{1}.csv" -f ($Server -replace '[\\/ ]', '-'), (Get-Date -Format 'yyyyMMdd-HHmmss') }
if (-not $Folders) {
    $Folders = @(Get-ChildItem -LiteralPath $DataDir -Directory | Where-Object { $_.Name -match '^mail\d*$' } | ForEach-Object { $_.Name })
}
$rows = foreach ($f in $Folders) {
    $p = Join-Path $DataDir $f
    if (Test-Path -LiteralPath $p) {
        Get-ChildItem -LiteralPath $p -File -Filter *.nsf | ForEach-Object {
            [pscustomobject]@{ Server = $Server; Path = "$f\$($_.Name)"; Bytes = $_.Length; Modified = $_.LastWriteTime.ToString('yyyy-MM-dd HH:mm') }
        }
    }
}
$rows | Export-Csv -LiteralPath $Out -NoTypeInformation -Encoding UTF8
Write-Host "Wrote $Out ($(@($rows).Count) mail files)"
