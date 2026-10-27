$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$local = Join-Path $project '.local'
$mysqlHome = if ($env:MYSQL_HOME) { $env:MYSQL_HOME } else { "$env:ProgramFiles/MySQL/MySQL Server 8.0" }
$mysqld = Join-Path $mysqlHome 'bin/mysqld.exe'
$mysql = Join-Path $mysqlHome 'bin/mysql.exe'
if (-not (Test-Path $mysqld)) { throw 'Install MySQL 8.0+ or set DB_URL, DB_USERNAME and DB_PASSWORD for your own server.' }
New-Item $local -ItemType Directory -Force | Out-Null
$connectionPath = Join-Path $local 'connection.json'
if (-not (Test-Path $connectionPath)) {
    [ordered]@{ port = 3307; username = 'lifequest'; password = [guid]::NewGuid().ToString('N'); rootPassword = [guid]::NewGuid().ToString('N') } |
        ConvertTo-Json | Set-Content $connectionPath -Encoding ASCII
}
$connection = Get-Content $connectionPath -Raw | ConvertFrom-Json
$projectHash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($project.ToLowerInvariant()))).Replace('-', '').Substring(0, 12)
$databaseHome = if ($env:LIFEQUEST_DATA_DIR) { $env:LIFEQUEST_DATA_DIR } else { Join-Path $env:USERPROFILE "AppData/Local/LifeQuest/$projectHash" }
if ($databaseHome -match '[^\x00-\x7F]') { throw 'MySQL requires an ASCII path. Set LIFEQUEST_DATA_DIR to an ASCII-only directory.' }
New-Item $databaseHome -ItemType Directory -Force | Out-Null
$data = Join-Path $databaseHome 'mysql-data'
$ini = Join-Path $databaseHome 'mysql.ini'
$clientIni = Join-Path $databaseHome 'mysql-client.ini'
$serverConfig = @"
[mysqld]
basedir="$($mysqlHome.Replace('\','/'))"
datadir="$($data.Replace('\','/'))"
port=$($connection.port)
bind-address=127.0.0.1
mysqlx=0
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
default-time-zone=+09:00
log-error="$($databaseHome.Replace('\','/'))/mysql.log"
pid-file="$($databaseHome.Replace('\','/'))/mysql.pid"
"@
[System.IO.File]::WriteAllText($ini, $serverConfig, (New-Object System.Text.UTF8Encoding($false)))
@"
[client]
host=127.0.0.1
port=$($connection.port)
user=$($connection.username)
password=$($connection.password)
"@ | Set-Content $clientIni -Encoding ASCII
function Test-LocalDatabase {
    try {
        $result = & $mysql "--defaults-extra-file=$clientIni" --connect-timeout=1 --batch --skip-column-names -e 'SELECT 1' 2>$null
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}
if (-not (Test-LocalDatabase)) {
    if (-not (Test-Path "$data/mysql")) {
        Write-Host 'Initializing a project-local MySQL database...'
        Push-Location $databaseHome
        try {
            & $mysqld --defaults-file=mysql.ini --initialize-insecure
            if ($LASTEXITCODE -ne 0) { throw "MySQL initialization failed. See $databaseHome/mysql.log" }
        } finally { Pop-Location }
    }
    $bootstrap = Join-Path $databaseHome 'bootstrap.sql'
    @"
CREATE DATABASE IF NOT EXISTS lifequest CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS lifequest_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'lifequest'@'localhost' IDENTIFIED BY '$($connection.password)';
GRANT ALL PRIVILEGES ON lifequest.* TO 'lifequest'@'localhost';
GRANT ALL PRIVILEGES ON lifequest_test.* TO 'lifequest'@'localhost';
ALTER USER 'root'@'localhost' IDENTIFIED BY '$($connection.rootPassword)';
"@ | Set-Content $bootstrap -Encoding ASCII
    Write-Host "Starting project-local MySQL on port $($connection.port)..."
    $process = Start-Process -FilePath $mysqld -ArgumentList "--defaults-file=`"$ini`"", "--init-file=`"$bootstrap`"" -WorkingDirectory $databaseHome -WindowStyle Hidden -PassThru
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 500
        if (Test-LocalDatabase) { $ready = $true; break }
        if ($process.HasExited) { break }
    }
    if (-not $ready) { throw "MySQL startup failed. Check port 3307 and $databaseHome/mysql.log" }
    Remove-Item -LiteralPath $bootstrap
}
$env:DB_URL = "jdbc:mysql://127.0.0.1:$($connection.port)/lifequest?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8"
$env:DB_USERNAME = $connection.username
$env:DB_PASSWORD = $connection.password
