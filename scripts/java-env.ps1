$ErrorActionPreference = 'Stop'
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME/bin/javac.exe")) {
    $jdk = Get-ChildItem "$env:ProgramFiles/Java" -Directory -Filter 'jdk-*' -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -First 1
    if (-not $jdk) { throw 'Install JDK 21 and set JAVA_HOME before running LifeQuest.' }
    $env:JAVA_HOME = $jdk.FullName
}
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
