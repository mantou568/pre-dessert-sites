# Commit with UTF-8 message (avoids mojibake on Windows)
# Usage: .\scripts\commit-utf8.ps1 "你的提交说明"
#        .\scripts\commit-utf8.ps1 "message" -- file1 file2  (stage then commit)

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Message,
    [Parameter(ValueFromRemainingArguments = $true)]
    $Rest
)

$ErrorActionPreference = 'Stop'
$msgFile = Join-Path $env:TEMP "pre-dessert-sites-commit-msg-utf8.txt"

# Write message as UTF-8 no BOM (Git expects this)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($msgFile, $Message, $utf8NoBom)

$root = Split-Path $PSScriptRoot -Parent
if (-not $root) { $root = (Get-Location).Path }
Set-Location $root

if ($Rest -and $Rest.Count -gt 0) {
    git add $Rest
}
git commit -F $msgFile

Remove-Item $msgFile -Force -ErrorAction SilentlyContinue
