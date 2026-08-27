# Build APK from this project (Windows, no Android Studio)
# Usage:  powershell -ExecutionPolicy Bypass -File .\build-apk.ps1 -ZipPath "D:\Downloads\commandlinetools-win-11076708_latest.zip"

param(
    [Parameter(Mandatory=$true)]
    [string]$ZipPath,

    [string]$SdkRoot = "D:\Android\Sdk"
)

$ErrorActionPreference = 'Stop'

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

# ---- 1. Verify prerequisites -------------------------------------------
Step "Checking prerequisites"
$jdk = (& java -version 2>&1 | Select-String -Pattern '"(\d+)\.' ) | Select-Object -First 1
if (-not $jdk) { throw "JDK not found in PATH. Install JDK 17 and ensure java.exe is on PATH." }
Write-Host "JDK: $($jdk.Line)"

if (-not (Test-Path $ZipPath)) { throw "Zip not found: $ZipPath" }
$zipSize = [math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
Write-Host "Zip:  $ZipPath ($zipSize MB)"
if ($zipSize -lt 100) { throw "Zip looks incomplete (< 100 MB). Re-download from https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" }

# ---- 2. Unpack cmdline-tools into SdkRoot -----------------------------
Step "Unpacking cmdline-tools to $SdkRoot"
$dst = Join-Path $SdkRoot "cmdline-tools\latest"
if (Test-Path $dst) { Write-Host "Already exists: $dst (skipping extract)" }
else {
    New-Item -ItemType Directory -Path (Join-Path $SdkRoot "cmdline-tools") -Force | Out-Null
    $tmp = Join-Path $env:TEMP "sdk-unzip"
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    New-Item -ItemType Directory -Path $tmp | Out-Null
    Write-Host "Extracting (this can take ~1 min)..."
    Expand-Archive -Path $ZipPath -DestinationPath $tmp -Force
    # zip has a top-level "cmdline-tools" folder containing bin/lib/...
    if (Test-Path (Join-Path $tmp "cmdline-tools")) {
        Move-Item (Join-Path $tmp "cmdline-tools") $dst
    } else {
        Move-Item (Join-Path $tmp "*") $dst -Force
    }
    Remove-Item $tmp -Recurse -Force
}
Write-Host "Unpacked to $dst"

# ---- 3. Set ANDROID_HOME for this session ------------------------------
Step "Setting ANDROID_HOME"
$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot
$env:Path = "$SdkRoot\cmdline-tools\latest\bin;$SdkRoot\platform-tools;" + $env:Path
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $SdkRoot, "User")
[System.Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $SdkRoot, "User")
Write-Host "ANDROID_HOME = $SdkRoot"

# ---- 4. Install SDK components ----------------------------------------
Step "Installing SDK components (platform-tools, platforms;android-34, build-tools;34.0.0)"
$sdkmgr = Join-Path $SdkRoot "cmdline-tools\latest\bin\sdkmanager.bat"
if (-not (Test-Path $sdkmgr)) { throw "sdkmanager.bat not found at $sdkmgr" }

# Accept all licenses non-interactively
Write-Host "Accepting licenses..."
$licensesDir = Join-Path $SdkRoot "licenses"
if (-not (Test-Path $licensesDir)) { New-Item -ItemType Directory -Path $licensesDir | Out-Null }
# Write the standard SDK license SHA1 acceptances
@'
24333f8a63b6825ea9c5514f83c28254bfffb88a
84831b9409646a918e30573bab4c9c91346d8abd
601085b94cd77f0a54c0c1155799a8a60b1e7c8d
'@ -split "`n" | ForEach-Object { $t = $_.Trim(); if ($t) { Set-Content -Path (Join-Path $licensesDir "android-sdk-license") -Value $t -Append } }

$pkgs = @("platform-tools", "platforms;android-34", "build-tools;34.0.0")
foreach ($pkg in $pkgs) {
    Write-Host "==> $pkg"
    & $sdkmgr --install $pkg 2>&1 | ForEach-Object { Write-Host "  $_" }
}

# ---- 5. Accept remaining licenses (newer SDKs) -------------------------
Write-Host "Final license acceptance..."
& $sdkmgr --licenses 2>&1 | Out-Null
yes | & $sdkmgr --licenses 2>&1 | Out-Null

# ---- 6. Build the APK --------------------------------------------------
Step "Building APK with Gradle"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $projectRoot "android")

# Make sure web assets are synced
Set-Location $projectRoot
& npx cap copy android 2>&1 | Out-Null
Set-Location (Join-Path $projectRoot "android")

& .\gradlew assembleDebug --no-daemon 2>&1 | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -ne 0) { throw "Gradle build failed." }

Step "DONE"
$apk = Join-Path (Join-Path $projectRoot "android\app\build\outputs\apk\debug") "app-debug.apk"
if (Test-Path $apk) {
    $apkSize = [math]::Round((Get-Item $apk).Length / 1MB, 2)
    Write-Host "APK ready:" -ForegroundColor Green
    Write-Host "  $apk ($apkSize MB)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Copy this file to your Android phone and tap to install."
    Write-Host "(You may need to enable 'Install from unknown sources' in Settings.)"
} else {
    Write-Host "Build said OK but APK not found at $apk — check Gradle output above."
}
