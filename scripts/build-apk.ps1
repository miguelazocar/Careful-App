<#
.SYNOPSIS
  Builds a signed release APK of Careful locally (Windows).

.DESCRIPTION
  1. Loads signing secrets from $env:USERPROFILE\.careful\signing.env (never committed).
  2. Regenerates the native Android project (Continuous Native Generation).
  3. Runs Gradle assembleRelease for the requested ABIs.
  4. Copies the APK to .\dist\Careful-<version>.apk

.EXAMPLE
  .\scripts\build-apk.ps1
  .\scripts\build-apk.ps1 -Abis "arm64-v8a,x86_64" -SkipPrebuild
#>
param(
  [string]$Abis = "arm64-v8a,armeabi-v7a,x86_64",
  [switch]$SkipPrebuild
)

# Native tools (npx, gradlew) print warnings to stderr; in Windows PowerShell 5.1 "Stop" would turn
# those into fatal errors. We rely on $LASTEXITCODE instead.
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$signing = Join-Path $env:USERPROFILE ".careful\signing.env"
if (Test-Path $signing) {
  Get-Content $signing | Where-Object { $_ -match "^\s*[A-Z_]+=" } | ForEach-Object {
    $name, $value = $_ -split "=", 2
    Set-Item -Path "env:$name" -Value $value
  }
  Write-Host "Signing with Careful release keystore." -ForegroundColor Green
} else {
  Write-Warning "No signing.env found: the APK will be signed with the default debug key."
}

if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr" }

if (-not $SkipPrebuild) {
  $env:CI = "1"
  npx expo prebuild --platform android --clean
  if ($LASTEXITCODE -ne 0) { throw "expo prebuild failed" }
}

Push-Location android
try {
  .\gradlew.bat assembleRelease "-PreactNativeArchitectures=$Abis" --no-daemon
  if ($LASTEXITCODE -ne 0) { throw "Gradle build failed" }
} finally {
  Pop-Location
}

$version = (Get-Content app.json -Raw | ConvertFrom-Json).expo.version
New-Item -ItemType Directory -Force dist | Out-Null
$out = Join-Path $root "dist\Careful-$version.apk"
Copy-Item "android\app\build\outputs\apk\release\app-release.apk" $out -Force
Write-Host "APK ready: $out" -ForegroundColor Green
