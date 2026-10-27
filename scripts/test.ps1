$ErrorActionPreference = 'Stop'
if (-not $env:DB_URL) {
    & "$PSScriptRoot/local-mysql.ps1"
    $env:DB_TEST_URL = $env:DB_URL.Replace('/lifequest?', '/lifequest_test?')
}
if (-not $env:DB_TEST_URL -or $env:DB_TEST_URL -eq $env:DB_URL) {
    throw 'Set DB_TEST_URL to a separate test database before running integration tests.'
}
$project = Split-Path $PSScriptRoot -Parent
Push-Location $project
try {
    & npm.cmd run check
    if ($LASTEXITCODE -ne 0) { throw 'JavaScript syntax check failed.' }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'JavaScript tests failed.' }
    & "$PSScriptRoot/maven.ps1" test
} finally { Pop-Location }
