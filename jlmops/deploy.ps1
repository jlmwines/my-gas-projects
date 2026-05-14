# JLM Wines — Apps Script deploy wrapper.
# Forces every deploy to use the pinned stable deployment ID, then verifies the
# pinned ID survived. Prevents the recurring "bare clasp deploy creates an
# orphan URL" failure mode (see memory: jlm_stable_deploy_id).
#
# Usage:
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
