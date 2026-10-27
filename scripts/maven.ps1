$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/java-env.ps1"
$project = Split-Path $PSScriptRoot -Parent
$maven = Get-Command mvn.cmd -ErrorAction SilentlyContinue
$mavenPath = if ($maven) { $maven.Source } else { $null }
if (-not $mavenPath) {
    $cached = Get-ChildItem "$env:USERPROFILE/.m2/wrapper/dists" -Recurse -Filter mvn.cmd -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cached) { $mavenPath = $cached.FullName }
}
if (-not $mavenPath) {
    $toolsDir = Join-Path $project '.tools'
    $mavenPath = Join-Path $toolsDir 'apache-maven-3.9.16/bin/mvn.cmd'
    if (-not (Test-Path $mavenPath)) {
        New-Item $toolsDir -ItemType Directory -Force | Out-Null
        $archive = Join-Path $toolsDir 'apache-maven-3.9.16-bin.zip'
        $url = 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.16/apache-maven-3.9.16-bin.zip'
        Invoke-WebRequest -UseBasicParsing $url -OutFile $archive
        $expected = (Invoke-WebRequest -UseBasicParsing "$url.sha512").Content.Trim().Split(' ')[0]
        if ((Get-FileHash $archive -Algorithm SHA512).Hash -ne $expected) { throw 'Maven download checksum mismatch.' }
        Expand-Archive $archive $toolsDir -Force
    }
}
$repository = Join-Path $project '.tools/repository'
if (-not (Test-Path $repository)) {
    New-Item $repository -ItemType Directory -Force | Out-Null
    $cache = Join-Path $env:USERPROFILE '.m2/repository'
    if (Test-Path $cache) { Copy-Item "$cache/*" $repository -Recurse -Force }
}
& $mavenPath "-Dmaven.repo.local=$repository" -f "$project/backend/pom.xml" @args
if ($LASTEXITCODE -ne 0) { throw "Maven failed with exit code $LASTEXITCODE." }
