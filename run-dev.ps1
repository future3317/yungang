# Run from the repository root while the piepaper Conda environment is active.
$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot

Push-Location (Join-Path $repoRoot 'frontend')
try {
    npm run build
}
finally {
    Pop-Location
}

python -m uvicorn backend.app:app --reload --port 8000
