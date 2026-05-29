# JLM Wines — Apps Script deploy wrapper.
# Does three things, in order, as one unattended step:
#   1. Auto-stamps VERSION.built in WebApp.js with the REAL current Israel-local
#      time (computed here via the timezone API — never hand-typed, so it can
#      never be fabricated or drift). This is the single source of the deploy
#      timestamp the UI shows.
#   2. clasp push (uploads the freshly-stamped code).
#   3. clasp deploy to the pinned stable deployment ID, then verifies the pinned
#      ID survived. Prevents the recurring "bare clasp deploy creates an orphan
#      URL" failure mode (see memory: jlm_stable_deploy_id).
#
# Because the stamp must be pushed, this wrapper now owns the `clasp push` step —
# do NOT run `clasp push` separately before it for a code deploy; just run:
#   pwsh -NoProfile -File jlmops/deploy.ps1 "<description for this version>"

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Description
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$idFile = Join-Path $scriptDir '.deployment-id'

if (-not (Test-Path $idFile)) {
    Write-Error "Pinned deployment ID file missing: $idFile. Refusing to deploy."
    exit 1
}

$deployId = (Get-Content $idFile -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($deployId)) {
    Write-Error "Pinned deployment ID file is empty: $idFile. Refusing to deploy."
    exit 1
}

if ([string]::IsNullOrWhiteSpace($Description)) {
    Write-Error "Description is required. Usage: pwsh -File deploy.ps1 '<description>'"
    exit 1
}

Write-Host "Deploying to pinned ID $deployId" -ForegroundColor Cyan
Write-Host "Description: $Description"

Push-Location $scriptDir
try {
    # --- 1. Auto-stamp VERSION.built with the real deploy time (Israel local) ---
    # Computed here, never hand-typed, so the timestamp cannot be fabricated or
    # drift. Reflects deploy-start; push+deploy then take a few more seconds.
    $webAppPath = Join-Path $scriptDir 'WebApp.js'
    if (-not (Test-Path $webAppPath)) {
        Write-Error "WebApp.js not found at $webAppPath. Refusing to deploy."
        exit 3
    }
    $israelTime = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'Israel Standard Time').ToString('yyyy-MM-dd HH:mm')
    $webAppSrc = [System.IO.File]::ReadAllText($webAppPath)
    if ($webAppSrc -notmatch "built:\s*'[^']*'") {
        Write-Error "Could not find a VERSION.built line in WebApp.js. Refusing to deploy."
        exit 3
    }
    $webAppSrc = [regex]::Replace($webAppSrc, "built:\s*'[^']*'", "built: '$israelTime'")
    [System.IO.File]::WriteAllText($webAppPath, $webAppSrc, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Stamped VERSION.built = $israelTime (Israel local)" -ForegroundColor Cyan

    # --- 2. Push the freshly-stamped code ---
    & clasp push -f
    if ($LASTEXITCODE -ne 0) {
        Write-Error "clasp push exited non-zero ($LASTEXITCODE). Aborting."
        exit $LASTEXITCODE
    }

    # --- 3. Deploy to the pinned stable ID ---
    & clasp deploy --deploymentId $deployId -d $Description
    if ($LASTEXITCODE -ne 0) {
        Write-Error "clasp deploy exited non-zero ($LASTEXITCODE). Aborting."
        exit $LASTEXITCODE
    }

    # Post-deploy verification: the pinned ID must still appear in the deployment list.
    $deployments = & clasp deployments 2>&1 | Out-String
    if (-not ($deployments -match [regex]::Escape($deployId))) {
        Write-Error "Verification failed: pinned ID $deployId not found in 'clasp deployments' output. Investigate before trusting the live URL."
        Write-Host $deployments
        exit 2
    }

    Write-Host "Deploy verified — pinned ID $deployId is present in deployments list." -ForegroundColor Green
}
finally {
    Pop-Location
}
