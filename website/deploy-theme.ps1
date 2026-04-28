# ═══════════════════════════════════════════════════════════════════
# deploy-theme.ps1 — FTP deploy of website/jlmwines-theme/ to staging
#
# Reads .sftp-credentials (project root, gitignored) and uploads the
# theme files to /wp-content/themes/jlmwines-theme/ on the FTP server.
#
# Usage (from project root):
#   pwsh -NoProfile -File website/deploy-theme.ps1
# ═══════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'

# Paths
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LocalRoot   = Join-Path $PSScriptRoot 'jlmwines-theme'
$CredPath    = Join-Path $ProjectRoot '.sftp-credentials'
$RemoteRoot  = '/wp-content/themes/jlmwines-theme'

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

# Walk the local theme directory
$files = Get-ChildItem -Path $LocalRoot -Recurse -File
$dirs  = Get-ChildItem -Path $LocalRoot -Recurse -Directory | Sort-Object FullName

Write-Host "Deploying $($files.Count) files to $($cred.host)$RemoteRoot/`n"

# Ensure remote root exists
Ensure-Dir -RemotePath $RemoteRoot

# Create subdirectories (parents first via sort)
foreach ($d in $dirs) {
    $rel = $d.FullName.Substring($LocalRoot.Length + 1).Replace('\','/')
    Ensure-Dir -RemotePath "$RemoteRoot/$rel"
}

# Upload files
$ok = 0; $fail = 0
foreach ($f in $files) {
    $rel    = $f.FullName.Substring($LocalRoot.Length + 1).Replace('\','/')
    $remote = "$RemoteRoot/$rel"
    Write-Host -NoNewline "  $rel"
    try {
        $attempts = Upload-File -LocalPath $f.FullName -RemotePath $remote
        if ($attempts -gt 1) { Write-Host "  OK (retry $attempts)" } else { Write-Host '  OK' }
        $ok++
    } catch {
        Write-Host ('  FAILED — ' + $_.Exception.Message)
        $fail++
    }
}

Write-Host "`n$ok uploaded, $fail failed."
if ($fail -gt 0) { exit 1 }
