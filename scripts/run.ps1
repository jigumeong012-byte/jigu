$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
. "$PSScriptRoot/java-env.ps1"
if (-not $env:DB_URL) { & "$PSScriptRoot/local-mysql.ps1" }
& "$PSScriptRoot/maven.ps1" -DskipTests package
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$webPort = if ($env:PORT) { $env:PORT } else { 8080 }
Write-Host "LifeQuest: http://localhost:$webPort (Ctrl+C to stop the web server)"
& "$env:JAVA_HOME/bin/java.exe" -jar "$project/backend/target/lifequest-1.0.0.jar"
