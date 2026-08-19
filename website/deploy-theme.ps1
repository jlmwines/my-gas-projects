# ═══════════════════════════════════════════════════════════════════
# deploy-theme.ps1 — FTP deploy of website/jlmwines-theme/ to LIVE
#
# Reads .sftp-credentials (project root, gitignored) and uploads only
# changed files (incremental) based on a SHA-1 manifest stored at
# .deploy-theme-manifest.json (project root, gitignored).
#
# Usage (from project root):
#   pwsh -NoProfile -File website/deploy-theme.ps1
#   pwsh -NoProfile -File website/deploy-theme.ps1 -Force
#
# Pass -Force to ignore the manifest and re-upload every file —
# typically once after a SiteGround staging refresh wipes the server.
#
# Upload-then-verify-then-replace (added 2026-08-20, incident response):
# a live file is NEVER written to directly. Each file uploads to a
# ".new" sibling, its remote byte count is checked against the local
# file, and only a byte-exact match gets renamed onto the live
# filename (FTP rename = atomic OS-level rename on SiteGround's Linux
# FTP server). A failed or truncated upload only ever corrupts the
# ".new" temp file — the live file is untouched until a verified-good
# upload exists. This exists because a prior run (root cause unclear —
# script and credentials unchanged for weeks, so likely a server-side
# change at SiteGround) truncated functions.php/style.css/main.css/
# main.js to 0 bytes live, breaking the site; see .claude/session-log.md
# 2026-08-20 and .claude/bugs.md.
# ═══════════════════════════════════════════════════════════════════

param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Paths
$ProjectRoot  = Split-Path -Parent $PSScriptRoot
$LocalRoot    = Join-Path $PSScriptRoot 'jlmwines-theme'
$CredPath     = Join-Path $ProjectRoot '.sftp-credentials'
$ManifestPath = Join-Path $ProjectRoot '.deploy-theme-manifest.json'
$RemoteRoot   = '/wp-content/themes/jlmwines-theme'

if (-not (Test-Path $CredPath))  { Write-Host "Error: $CredPath not found"; exit 1 }
if (-not (Test-Path $LocalRoot)) { Write-Host "Error: $LocalRoot not found"; exit 1 }

# Parse credentials
$cred = @{}
Get-Content $CredPath | ForEach-Object {
    if ($_ -match '^([\w-]+):\s*(.+)$') {
        $cred[$matches[1].Trim().Replace('-','_')] = $matches[2].Trim()
    }
}
foreach ($k in 'host','port','username','password') {
    if (-not $cred[$k]) { Write-Host "Error: $k missing in .sftp-credentials"; exit 1 }
}

# Transport: curl's FTPS client, not .NET's FtpWebRequest (switched
# 2026-08-20). FtpWebRequest started failing every upload with FTP 451
# against SiteGround — script/credentials unchanged for weeks, so most
# likely a server-side change at SiteGround; curl's FTPS implementation
# connects and transfers cleanly against the same account. See
# .claude/session-log.md 2026-08-20 and .claude/bugs.md.
if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
    Write-Host "Error: curl.exe not found on PATH"; exit 1
}
$userpass = "$($cred.username):$($cred.password)"
$baseUri  = "ftp://$($cred.host):$($cred.port)"

# -k: SiteGround's FTPS cert has a mismatched CN (cert is for the underlying
# server hostname, not the customer domain alias) — connection is still
# TLS-encrypted, this only relaxes hostname validation (same relaxation the
# old FtpWebRequest-based script made via ServerCertificateValidationCallback).
function Invoke-CurlFtp {
    param([string[]]$CurlArgs, [int]$TimeoutSec = 30)
    $allArgs = @('--ssl-reqd', '-k', '--user', $userpass, '--connect-timeout', '15', '-m', $TimeoutSec, '-s', '-S') + $CurlArgs
    $out = & curl.exe @allArgs 2>&1
    [PSCustomObject]@{ Output = ($out -join ' '); ExitCode = $LASTEXITCODE }
}

function Ensure-Dir {
    param([string]$RemotePath)
    Invoke-CurlFtp -CurlArgs @('--quote', "MKD $RemotePath", "$baseUri/") | Out-Null   # already exists is fine
}

function Get-RemoteSize {
    param([string]$RemotePath)
    $result = Invoke-CurlFtp -CurlArgs @('-I', "$baseUri$RemotePath")
    if ($result.ExitCode -ne 0) { throw "curl size-check failed (exit $($result.ExitCode)): $($result.Output)" }
    $match = [regex]::Match($result.Output, 'Content-Length:\s*(\d+)')
    if (-not $match.Success) { throw "Could not parse Content-Length from: $($result.Output)" }
    return [int64]$match.Groups[1].Value
}

function Rename-Remote {
    param([string]$FromPath, [string]$ToPath)
    $result = Invoke-CurlFtp -CurlArgs @('--quote', "RNFR $FromPath", '--quote', "RNTO $ToPath", "$baseUri/")
    if ($result.ExitCode -ne 0) { throw "curl rename failed (exit $($result.ExitCode)): $($result.Output)" }
}

function Delete-Quiet {
    param([string]$RemotePath)
    Invoke-CurlFtp -CurlArgs @('--quote', "DELE $RemotePath", "$baseUri/") | Out-Null  # best-effort temp-file cleanup
}

# Upload-then-verify-then-replace: never writes the live filename
# directly. See header comment for why (2026-08-20 incident).
function Upload-File {
    param([string]$LocalPath, [string]$RemotePath, [int]$MaxRetries = 3)
    $localSize = (Get-Item $LocalPath).Length
    $tempPath  = "$RemotePath.new"
    $lastErr   = $null

    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $up = Invoke-CurlFtp -CurlArgs @('-T', $LocalPath, "$baseUri$tempPath")
            if ($up.ExitCode -ne 0) { throw "curl upload failed (exit $($up.ExitCode)): $($up.Output)" }

            $remoteSize = Get-RemoteSize -RemotePath $tempPath
            if ($remoteSize -ne $localSize) {
                throw "Size mismatch after upload: local $localSize bytes, remote $remoteSize bytes (temp file, live file untouched)"
            }

            Rename-Remote -FromPath $tempPath -ToPath $RemotePath
            return $i  # attempt count it succeeded on
        } catch {
            $lastErr = $_
            Delete-Quiet -RemotePath $tempPath
            if ($i -lt $MaxRetries) { Start-Sleep -Milliseconds 800 }
        }
    }
    throw $lastErr
}

function Delete-File {
    param([string]$RemotePath, [int]$MaxRetries = 3)
    $lastErr = $null
    for ($i = 1; $i -le $MaxRetries; $i++) {
        $result = Invoke-CurlFtp -CurlArgs @('--quote', "DELE $RemotePath", "$baseUri/")
        if ($result.ExitCode -eq 0) { return $i }
        # FTP 550 = file not found; treat as already-gone success.
        if ($result.Output -match '550') { return 0 }
        $lastErr = $result.Output
        if ($i -lt $MaxRetries) { Start-Sleep -Milliseconds 800 }
    }
    throw $lastErr
}

# Load existing manifest (rel_path → SHA-1 hex). Empty if -Force or
# missing — then everything is treated as new and gets uploaded.
$prevHashes = @{}
if (-not $Force -and (Test-Path $ManifestPath)) {
    try {
        $manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
        if ($manifest.files) {
            $manifest.files.PSObject.Properties | ForEach-Object {
                $prevHashes[$_.Name] = $_.Value
            }
        }
    } catch {
        Write-Host "Warning: manifest unreadable, treating all files as new"
        $prevHashes = @{}
    }
}

# Walk the local theme directory
$files = Get-ChildItem -Path $LocalRoot -Recurse -File
$dirs  = Get-ChildItem -Path $LocalRoot -Recurse -Directory | Sort-Object FullName

# Compute hashes + decide which files need upload
$toUpload   = @()
$newHashes  = @{}
foreach ($f in $files) {
    $rel  = $f.FullName.Substring($LocalRoot.Length + 1).Replace('\','/')
    $hash = (Get-FileHash -Path $f.FullName -Algorithm SHA1).Hash
    $newHashes[$rel] = $hash
    if ($Force -or -not $prevHashes.ContainsKey($rel) -or $prevHashes[$rel] -ne $hash) {
        $toUpload += [PSCustomObject]@{ Rel = $rel; FullName = $f.FullName }
    }
}

# Orphans = files in last manifest that no longer exist locally. Skip
# in -Force mode (prevHashes is empty, so this list is empty anyway).
$toDelete = @()
foreach ($prev in $prevHashes.Keys) {
    if (-not $newHashes.ContainsKey($prev)) {
        $toDelete += $prev
    }
}

if ($toUpload.Count -eq 0 -and $toDelete.Count -eq 0) {
    Write-Host "No changes since last deploy. ($($files.Count) files in manifest)"
    Write-Host "Run with -Force to re-upload everything (e.g. after staging refresh)."
    exit 0
}

$mode = if ($Force) { 'force' } else { 'incremental' }
$summary = "$($toUpload.Count) of $($files.Count) files"
if ($toDelete.Count -gt 0) { $summary += " (+ $($toDelete.Count) orphan$(if ($toDelete.Count -ne 1) {'s'}) to delete)" }
Write-Host "Deploying $summary to $($cred.host)$RemoteRoot/ ($mode)`n"

# Ensure remote root + subdirectories (parents first via sort).
# Cheap to always run; FTP MKD on existing dir just fails silently.
Ensure-Dir -RemotePath $RemoteRoot
foreach ($d in $dirs) {
    $rel = $d.FullName.Substring($LocalRoot.Length + 1).Replace('\','/')
    Ensure-Dir -RemotePath "$RemoteRoot/$rel"
}

# Upload only the changed/new files
$ok = 0; $fail = 0
foreach ($f in $toUpload) {
    $remote = "$RemoteRoot/$($f.Rel)"
    Write-Host -NoNewline "  $($f.Rel)"
    try {
        $attempts = Upload-File -LocalPath $f.FullName -RemotePath $remote
        if ($attempts -gt 1) { Write-Host "  OK (retry $attempts)" } else { Write-Host '  OK' }
        $ok++
    } catch {
        Write-Host ('  FAILED — ' + $_.Exception.Message)
        $fail++
        # On failure, drop this file's hash so the next run retries it.
        $newHashes.Remove($f.Rel) | Out-Null
        if ($prevHashes.ContainsKey($f.Rel)) {
            $newHashes[$f.Rel] = $prevHashes[$f.Rel]
        }
    }
}

# Delete orphans (files in the previous manifest that no longer exist
# locally). On failure, keep the orphan in the manifest so next run
# retries the delete.
$delOk = 0
foreach ($rel in $toDelete) {
    $remote = "$RemoteRoot/$rel"
    Write-Host -NoNewline "  - $rel"
    try {
        $attempts = Delete-File -RemotePath $remote
        if ($attempts -eq 0) { Write-Host '  GONE' } elseif ($attempts -gt 1) { Write-Host "  DELETED (retry $attempts)" } else { Write-Host '  DELETED' }
        $delOk++
    } catch {
        Write-Host ('  FAILED — ' + $_.Exception.Message)
        $fail++
        $newHashes[$rel] = $prevHashes[$rel]
    }
}

# Persist updated manifest. Files that failed retain their previous
# hash (or no hash if new) so the next run will re-attempt them.
$manifestOut = [PSCustomObject]@{
    version    = 1
    lastDeploy = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    files      = $newHashes
}
$manifestOut | ConvertTo-Json -Depth 4 | Set-Content -Path $ManifestPath -Encoding UTF8

Write-Host "`n$ok uploaded, $delOk deleted, $fail failed."
if ($fail -gt 0) { exit 1 }
