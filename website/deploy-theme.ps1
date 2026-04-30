# ═══════════════════════════════════════════════════════════════════
# deploy-theme.ps1 — FTP deploy of website/jlmwines-theme/ to staging
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

# SiteGround FTPS uses cert with mismatched CN (cert is for the underlying
# server hostname, not the customer domain alias). Connection is still
# TLS-encrypted; we only relax hostname validation.
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

$networkCred = New-Object System.Net.NetworkCredential($cred.username, $cred.password)
$baseUri     = "ftp://$($cred.host):$($cred.port)"

function Invoke-Ftp {
    param([string]$RemotePath, [string]$Method, [byte[]]$Body)
    $req = [System.Net.FtpWebRequest]::Create("$baseUri$RemotePath")
    $req.Method      = $Method
    $req.Credentials = $networkCred
    $req.EnableSsl   = $true
    $req.UsePassive  = $true
    $req.UseBinary   = $true
    $req.KeepAlive   = $false
    if ($Body) {
        $req.ContentLength = $Body.Length
        $stream = $req.GetRequestStream()
        $stream.Write($Body, 0, $Body.Length)
        $stream.Close()
    }
    $req.GetResponse()
}

function Ensure-Dir {
    param([string]$RemotePath)
    try { (Invoke-Ftp -RemotePath $RemotePath -Method ([System.Net.WebRequestMethods+Ftp]::MakeDirectory)).Close() }
    catch { }   # already exists is fine
}

function Upload-File {
    param([string]$LocalPath, [string]$RemotePath, [int]$MaxRetries = 3)
    $bytes = [System.IO.File]::ReadAllBytes($LocalPath)
    $lastErr = $null
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            (Invoke-Ftp -RemotePath $RemotePath -Method ([System.Net.WebRequestMethods+Ftp]::UploadFile) -Body $bytes).Close()
            return $i  # attempt count it succeeded on
        } catch {
            $lastErr = $_
            if ($i -lt $MaxRetries) { Start-Sleep -Milliseconds 800 }
        }
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

if ($toUpload.Count -eq 0) {
    Write-Host "No changes since last deploy. ($($files.Count) files in manifest)"
    Write-Host "Run with -Force to re-upload everything (e.g. after staging refresh)."
    exit 0
}

$mode = if ($Force) { 'force' } else { 'incremental' }
Write-Host "Deploying $($toUpload.Count) of $($files.Count) files to $($cred.host)$RemoteRoot/ ($mode)`n"

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

# Persist updated manifest. Files that failed retain their previous
# hash (or no hash if new) so the next run will re-attempt them.
$manifestOut = [PSCustomObject]@{
    version    = 1
    lastDeploy = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    files      = $newHashes
}
$manifestOut | ConvertTo-Json -Depth 4 | Set-Content -Path $ManifestPath -Encoding UTF8

Write-Host "`n$ok uploaded, $fail failed."
if ($fail -gt 0) { exit 1 }
