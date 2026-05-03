# ═══════════════════════════════════════════════════════════════════
# fetch-kowine-emails.ps1 — Download KoWine's WooCommerce email overrides
#
# One-off tool: pulls /wp-content/themes/kowine/woocommerce/emails/*
# from staging FTP into website/jlmwines-theme/woocommerce/emails/.
# Used to capture customized email templates for cutover.
# ═══════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$CredPath    = Join-Path $ProjectRoot '.sftp-credentials'
$OutDir      = Join-Path $PSScriptRoot 'jlmwines-theme/woocommerce/emails'
$RemoteDir   = '/wp-content/themes/kowine-child/woocommerce/emails'

if (-not (Test-Path $CredPath)) { Write-Host "Error: $CredPath not found"; exit 1 }

$cred = @{}
Get-Content $CredPath | ForEach-Object {
    if ($_ -match '^([\w-]+):\s*(.+)$') {
        $cred[$matches[1].Trim().Replace('-','_')] = $matches[2].Trim()
    }
}

[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
$networkCred = New-Object System.Net.NetworkCredential($cred.username, $cred.password)
$baseUri     = "ftp://$($cred.host):$($cred.port)"

# List remote dir
$req = [System.Net.FtpWebRequest]::Create("$baseUri$RemoteDir/")
$req.Method      = [System.Net.WebRequestMethods+Ftp]::ListDirectory
$req.Credentials = $networkCred
$req.EnableSsl   = $true
$req.UsePassive  = $true

try {
    $resp   = $req.GetResponse()
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $listing = $reader.ReadToEnd()
    $reader.Close()
    $resp.Close()
} catch {
    Write-Host "Error listing $RemoteDir`: $($_.Exception.Message)"
    exit 1
}

$files = $listing -split "`r?`n" | Where-Object { $_ -and $_ -notmatch '^\.' -and $_ -match '\.php$' } | ForEach-Object {
    Split-Path $_ -Leaf
}

if (-not $files) {
    Write-Host "No .php files found in $RemoteDir"
    exit 0
}

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

Write-Host "Found $($files.Count) email override file(s) in kowine. Downloading...`n"

foreach ($f in $files) {
    $remote = "$RemoteDir/$f"
    $local  = Join-Path $OutDir $f
    Write-Host -NoNewline "  $f"
    try {
        $dlReq = [System.Net.FtpWebRequest]::Create("$baseUri$remote")
        $dlReq.Method      = [System.Net.WebRequestMethods+Ftp]::DownloadFile
        $dlReq.Credentials = $networkCred
        $dlReq.EnableSsl   = $true
        $dlReq.UsePassive  = $true
        $dlReq.UseBinary   = $true

        $dlResp = $dlReq.GetResponse()
        $stream = $dlResp.GetResponseStream()
        $out    = [System.IO.File]::Create($local)
        $stream.CopyTo($out)
        $out.Close()
        $stream.Close()
        $dlResp.Close()

        $size = (Get-Item $local).Length
        Write-Host "  OK ($size bytes)"
    } catch {
        Write-Host ('  FAILED — ' + $_.Exception.Message)
    }
}

Write-Host "`nFiles saved to: $OutDir"
