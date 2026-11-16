<#
.SYNOPSIS
  Publica una versión nueva de Careful: versión, CHANGELOG, APK firmado, tag y Release en GitHub.

.DESCRIPTION
  1. Sube la versión (package.json, package-lock.json y app.json, con versionCode + 1).
  2. Cierra la sección [Sin publicar] del CHANGELOG como [X.Y.Z] — fecha.
  3. Corre npm run check y compila el APK firmado (con prebuild, para que Android tome la versión).
  4. Commitea "release: X.Y.Z", crea el tag vX.Y.Z y lo sube a GitHub.
  5. GitHub Actions crea la Release con las notas del CHANGELOG; el APK se adjunta con GitHub CLI.
  6. Copia el APK a la carpeta de entrega (Google Drive) y quita las versiones anteriores de ahí.

  Para adjuntar el APK usa GitHub CLI (gh), autorizado una vez con "gh auth login". Si algo falla
  antes del commit, deja los archivos como estaban.

.EXAMPLE
  .\scripts\release.ps1                  # 1.2.0 -> 1.2.1
  .\scripts\release.ps1 -Bump minor      # 1.2.1 -> 1.3.0
  .\scripts\release.ps1 -Version 2.0.0
  .\scripts\release.ps1 -DryRun          # compila todo localmente; no commitea, no sube, no publica
#>
param(
  [ValidateSet('patch', 'minor', 'major')]
  [string]$Bump = 'patch',
  [string]$Version,
  [string]$DeliveryDir = 'G:\Mi unidad\Careful',
  [string]$CommitTrailer,
  [switch]$DryRun
)

# Native tools write warnings to stderr; rely on exit codes instead of terminating errors.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$utf8 = New-Object System.Text.UTF8Encoding $false
$touched = @('package.json', 'package-lock.json', 'app.json', 'CHANGELOG.md')

function Fail([string]$message) {
  Write-Host "X $message" -ForegroundColor Red
  exit 1
}
function Revert {
  git checkout -- $touched 2>$null | Out-Null
}
function Step([string]$message) { Write-Host "`n> $message" -ForegroundColor Cyan }

# ---------------------------------------------------------------- 1. Preconditions
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') { Fail "Publicá desde main (estás en $branch)." }
if (git status --porcelain) { Fail 'Hay cambios sin commitear: commitealos antes de publicar.' }

$changelogPath = Join-Path $root 'CHANGELOG.md'
$changelog = [IO.File]::ReadAllText($changelogPath, $utf8) -replace "`r`n", "`n"
$section = [regex]::Match($changelog, '(?s)## \[Sin publicar\]\n(.*?)(?=\n## \[)')
if (-not $section.Success -or -not $section.Groups[1].Value.Trim()) {
  Fail 'La sección [Sin publicar] del CHANGELOG está vacía: no hay nada para publicar.'
}
$notes = $section.Groups[1].Value.Trim()

$current = (Get-Content package.json -Raw | ConvertFrom-Json).version
if (-not $Version) {
  $p = $current.Split('.') | ForEach-Object { [int]$_ }
  switch ($Bump) {
    'major' { $Version = "$($p[0] + 1).0.0" }
    'minor' { $Version = "$($p[0]).$($p[1] + 1).0" }
    default { $Version = "$($p[0]).$($p[1]).$($p[2] + 1)" }
  }
}
if ($Version -notmatch '^\d+\.\d+\.\d+$') { Fail "Versión inválida: $Version" }
$tag = "v$Version"
if (git tag --list $tag) { Fail "El tag $tag ya existe." }
Write-Host "Careful $current -> $Version$(if ($DryRun) { ' (prueba: no se publica nada)' })" -ForegroundColor Green

# ---------------------------------------------------------------- 2. Version and CHANGELOG
Step 'Versión y CHANGELOG'
npm version $Version --no-git-tag-version --allow-same-version | Out-Null
if ($LASTEXITCODE -ne 0) { Revert; Fail 'npm version falló.' }

$app = [IO.File]::ReadAllText((Join-Path $root 'app.json'), $utf8)
$app = ([regex]'"version":\s*"[^"]+"').Replace($app, "`"version`": `"$Version`"", 1)
$code = [int]([regex]::Match($app, '"versionCode":\s*(\d+)').Groups[1].Value)
$app = ([regex]'"versionCode":\s*\d+').Replace($app, "`"versionCode`": $($code + 1)", 1)
[IO.File]::WriteAllText((Join-Path $root 'app.json'), $app, $utf8)

$date = Get-Date -Format 'yyyy-MM-dd'
$dash = [char]0x2014
$changelog = $changelog.Replace("## [Sin publicar]`n", "## [Sin publicar]`n`n## [$Version] $dash $date`n")
[IO.File]::WriteAllText($changelogPath, $changelog, $utf8)
Write-Host "versionCode $code -> $($code + 1); CHANGELOG: [$Version] $dash $date"

# ---------------------------------------------------------------- 3. Checks and build
Step 'npm run check'
npm run check
if ($LASTEXITCODE -ne 0) { Revert; Fail 'Los controles fallaron: no se publicó nada.' }

Step 'APK firmado'
& (Join-Path $PSScriptRoot 'build-apk.ps1')
$apk = Join-Path $root "dist\Careful-$Version.apk"
if (-not (Test-Path $apk)) { Revert; Fail 'No se generó el APK: no se publicó nada.' }

if ($DryRun) {
  Revert
  Write-Host "`nPrueba terminada: $apk compilado. No se commiteó, subió ni publicó nada." -ForegroundColor Green
  exit 0
}

# ---------------------------------------------------------------- 4. Commit, tag and push
Step "Commit y tag $tag"
$message = "release: $Version"
if ($CommitTrailer) { $message = "$message`n`n$CommitTrailer" }
git add -- $touched
git commit -q -m $message
if ($LASTEXITCODE -ne 0) { Revert; Fail 'No se pudo commitear.' }
git tag -a $tag -m "Careful $Version"
git push -q origin main
if ($LASTEXITCODE -ne 0) { Fail 'No se pudo subir main a GitHub (el commit y el tag quedaron locales).' }
git push -q origin $tag
if ($LASTEXITCODE -ne 0) { Fail "No se pudo subir el tag $tag." }

# ---------------------------------------------------------------- 5. GitHub Release
# The tag push triggers .github/workflows/release.yml, which creates the Release with the notes of
# this version from the CHANGELOG. The APK is attached here with GitHub CLI (gh), authorized once
# by the owner with "gh auth login"; this script never reads credentials.
Step 'Release en GitHub'
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh -and (Test-Path 'C:\Program Files\GitHub CLI\gh.exe')) { $gh = Get-Command 'C:\Program Files\GitHub CLI\gh.exe' }
$attached = $false
if ($gh) {
  & $gh auth status *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Host 'Esperando la Release que crea GitHub Actions...'
    for ($i = 0; $i -lt 36; $i++) {
      & $gh release view $tag *> $null
      if ($LASTEXITCODE -eq 0) { break }
      Start-Sleep -Seconds 5
    }
    & $gh release view $tag *> $null
    if ($LASTEXITCODE -ne 0) {
      # the workflow didn't run (Actions disabled?): create it here with the same notes
      $notesFile = Join-Path $env:TEMP "careful-$Version-notes.md"
      [IO.File]::WriteAllText($notesFile, $notes, $utf8)
      & $gh release create $tag --title "Careful $Version" --notes-file $notesFile
    }
    & $gh release upload $tag $apk --clobber
    $attached = $LASTEXITCODE -eq 0
  }
}
if ($attached) {
  Write-Host "Release con APK: $(& $gh release view $tag --json url --jq .url)" -ForegroundColor Green
} else {
  Write-Host "GitHub Actions publica la Release $tag con las notas del CHANGELOG." -ForegroundColor Yellow
  Write-Host "Para adjuntar el APK automáticamente, instalá GitHub CLI y autorizalo una vez:" -ForegroundColor Yellow
  Write-Host '  winget install --id GitHub.cli' -ForegroundColor Yellow
  Write-Host '  gh auth login' -ForegroundColor Yellow
  Write-Host "y adjuntá este APK con: gh release upload $tag `"$apk`"" -ForegroundColor Yellow
}
# ---------------------------------------------------------------- 6. Delivery folder
if ($DeliveryDir -and (Test-Path $DeliveryDir)) {
  Step "Copia a $DeliveryDir"
  Get-ChildItem $DeliveryDir -Filter 'Careful-*.apk' |
    Where-Object { $_.Name -match '^Careful-\d+\.\d+\.\d+\.apk$' -and $_.Name -ne "Careful-$Version.apk" } |
    Remove-Item -Force
  Copy-Item $apk (Join-Path $DeliveryDir "Careful-$Version.apk") -Force
  Write-Host "APK en $(Join-Path $DeliveryDir "Careful-$Version.apk")" -ForegroundColor Green
}

Write-Host "`nCareful $Version publicada." -ForegroundColor Green
