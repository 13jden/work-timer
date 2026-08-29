# Android APK ???? ? Salary Timer

> ??: Windows 11 ? Tauri 2.x ? Rust 1.82+ ? Android SDK build-tools 35 ? JDK 17
> ????: 0.1.0 (?? tauri.conf.json ? version)

---

## ??????

| ?? | ????? / ?? | ?? |
|------|-------------------|------|
| Node.js ? 20 | `node --version` | ?? `npm run build` |
| Rust stable | `rustup show` | 4 ? Android target |
| Tauri CLI | `npx tauri --version` | 2.x |
| JDK 17 | `E:\environment\jdk17` | Gradle ??? 17 |
| Android SDK | `C:\Users\admin\AppData\Local\Android\Sdk` | build-tools 35+ |

### ????

```powershell
$env:ANDROID_HOME = "C:\Users\admin\AppData\Local\Android\Sdk"
$env:JAVA_HOME    = "E:\environment\jdk17"
```

### Rust Android targets (???)

    rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android

---

## ???? Keystore (???? release.keystore)

| ?? | ? |
|------|---|
| keystore ?? | `release.keystore` |
| alias | `salarytimer` |
| storepass / keypass | `SalaryTimer2026` |
| ???? | **v2 + v3 only** (?? v1 JAR ??) |

????:

```powershell
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -keystore release.keystore -alias salarytimer -keyalg RSA -keysize 2048 -validity 10000 -storepass SalaryTimer2026 -keypass SalaryTimer2026
```

---

## ?????? (?? Android Adaptive Icon ??)

### ??
?? `npx tauri icon image/LS20260827102934.png` ??? Adaptive Icon ??? mask ?????? 30% ??(?????????),?? LOGO ????

### ?? (???, 2026-08-29 ????????)

**Step 1 ? ?????**: ? System.Drawing ??? `min(W,H)` ???,????????(??????),??? 1024?1024?300 dpi?????,??? `src-tauri/icon-source.png`?

```powershell
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile("image\LS20260827102934.png")
$side = [Math]::Min($src.Width, $src.Height)
$crop = New-Object System.Drawing.Bitmap $side, $side
$g = [System.Drawing.Graphics]::FromImage($crop)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($src, (New-Object System.Drawing.Rectangle 0,0,$side,$side),
  (New-Object System.Drawing.Rectangle (($src.Width-$side)/2), (($src.Height-$side)/2), $side, $side),
  [System.Drawing.GraphicsUnit]::Pixel)
$final = New-Object System.Drawing.Bitmap 1024, 1024
$g2 = [System.Drawing.Graphics]::FromImage($final)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$final.SetResolution(300, 300)
$g2.Clear([System.Drawing.Color]::Transparent)
$g2.DrawImage($crop, 0, 0, 1024, 1024)
$final.Save("src-tauri\icon-source.png", [System.Drawing.Imaging.ImageFormat]::Png)
```

**Step 2 ? manifest JSON (??!????)**: ?? `src-tauri/icon-manifest.json` ? `android_fg_scale: 80` ??????????:

```json
{ "default": "icon-source.png", "android_fg_scale": 80 }
```

| android_fg_scale | ?? |
|---|---|
| 100 (??) | ???? mask ? LOGO ???? ? |
| 80 (??) | ???? ~10% ? LOGO ???? ? |
| 70           | ???? ? ???? |

    cd src-tauri
    npx tauri icon icon-manifest.json
    cd ..

**Step 3**: tauri icon ????? adaptive-icon ??(xml + png)???? `src-tauri/gen/android/app/src/main/res/` ? mipmap-* ? drawable-anydpi-v26 ??,**??????**?

---

## ???????? (? jniLibs symlink ???)

### ??? ? Windows jniLibs ???????? (??!)

Tauri Gradle ?????? Rust .so ? symlink ?? jniLibs/<arch>??:
1. Windows 11 ????????????(???????)
2. ??????? symlink ????????

??: `New-Item : ??? jniLibs/arm64-v8a ???????? ? ????!`

**????????:**

```powershell
Remove-Item src-tauri\gen\android\app\src\main\jniLibs -Recurse -Force -EA SilentlyContinue
Remove-Item src-tauri\gen\android\app\build            -Recurse -Force -EA SilentlyContinue
Remove-Item src-tauri\target                              -Recurse -Force -EA SilentlyContinue
$jr = "src-tauri\gen\android\app\src\main\jniLibs"
foreach ($a in @("arm64-v8a","armeabi-v7a","x86","x86_64")) { mkdir "$jr\$a" -Force | Out-Null }
```
### Step 1 ? ????

    npm run build   # ? dist/

### Step 2 ? (???????) ?????????????

### Step 3 ? ?????????? + ?? jniLibs ?????

### Step 4 ? Tauri Android build --apk (Rust ?? .so)

    npx tauri android build --apk

> ??? **90% ???? jniLibs ????????**,??? 4 ?? Rust `.so` **?????**,
> ??? `src-tauri/target/<triple>/release/libapp_lib.so`?**????,?? Step 5!**

### Step 5 ? ?? HardLink .so ? jniLibs

Windows symlink ??,????(HardLink)?????:

```powershell
$tb = "src-tauri\target"
$jr = "src-tauri\gen\android\app\src\main\jniLibs"
$map = @{
  "aarch64-linux-android"   = "arm64-v8a"
  "armv7-linux-androideabi" = "armeabi-v7a"
  "i686-linux-android"      = "x86"
  "x86_64-linux-android"    = "x86_64"
}
foreach ($k in $map.Keys) {
  $s = "$tb\$k\release\libapp_lib.so"
  $d = "$jr\$($map[$k])\libapp_lib.so"
  if (Test-Path $s) {
    try { New-Item -ItemType HardLink -Path $d -Target (Resolve-Path $s).Path -Force -EA Stop | Out-Null }
    catch { Copy-Item $s $d -Force }
  }
}
```

### Step 6 ? Gradle assembleUniversalRelease (?? Rust ???)

???? `-x` ??,Tauri Gradle ??????? rustBuild ??,???? symlink ?:

```powershell
cd src-tauri\gen\android
$env:ANDROID_HOME = "C:\Users\admin\AppData\Local\Android\Sdk"
$env:JAVA_HOME    = "E:\environment\jdk17"
.\gradlew :app:assembleUniversalRelease `
  -x ":app:rustBuildArm64Release"  `
  -x ":app:rustBuildArmRelease"    `
  -x ":app:rustBuildX86Release"    `
  -x ":app:rustBuildX86_64Release" `
  -x ":app:rustBuildUniversalRelease" --no-daemon
```

?? **BUILD SUCCESSFUL** ?,unsigned APK ?:

    src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk

### Step 7 ? arm64 ??? (35 MB ? 12 MB, ??)

?? 99% ???? arm64-v8a,?? lib/armeabi-v7a?lib/x86?lib/x86_64 ?????
?????? **strip-arm64.cjs**(package.json type=module,?? .cjs ?? CommonJS):

```javascript
// strip-arm64.cjs  (????????)
const fs    = require("fs");
const yauzl = require("yauzl");
const yazl  = require("yazl");

const IN  = "src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk";
const OUT = "dist-android/arm64-unsigned.apk";
fs.mkdirSync("dist-android", { recursive: true });
fs.copyFileSync(IN, "dist-android/universal-unsigned.apk");

const out = new yazl.ZipFile();
yauzl.open(IN, { lazyEntries: true }, (err, zf) => {
  if (err) throw err;
  let dropped = 0;
  zf.readEntry();
  zf.on("entry", (entry) => {
    const isOtherArch = /^lib\/(armeabi-v7a|x86|x86_64)\//.test(entry.fileName);
    if (isOtherArch) { dropped++; zf.readEntry(); return; }
    zf.openReadStream(entry, (e2, stream) => {
      if (e2) throw e2;
      const isSo = entry.fileName.endsWith(".so");
      out.addReadStream(stream, entry.fileName, {
        mtime: entry.getLastModDate(),
        compress: !isSo,   // ? ??: .so ?? STORE ??(????)
      });                  //    ?? arm64 ???? 4~5 MB(??? ~12 MB)
      zf.readEntry();
    });
  });
  zf.on("end", () => {
    out.outputStream.pipe(fs.createWriteStream(OUT)).on("close", () => {
      console.log("dropped entries:", dropped);
      console.log("arm64 size:", (fs.statSync(OUT).size/1024/1024).toFixed(2), "MB");
    });
    out.end();
  });
});
```

??:  `node strip-arm64.cjs`

### Step 8 ? zipalign ?? + apksigner ?? (??????!)

> ?????!??? APK ????????build-tools ??:
> `C:\Users\admin\AppData\Local\Android\Sdk\build-tools\35.0.0\`

```powershell
$bt = "C:\Users\admin\AppData\Local\Android\Sdk\build-tools\35.0.0"

# A. 4 ?? zipalign
& "$bt\zipalign.exe" -f 4 dist-android\arm64-unsigned.apk     dist-android\SalaryTimer-0.1.0-arm64.apk
& "$bt\zipalign.exe" -f 4 dist-android\universal-unsigned.apk dist-android\SalaryTimer-0.1.0-universal.apk

# B. v2+v3 ??,?? v1 JAR ??
$apks = @("dist-android\SalaryTimer-0.1.0-arm64.apk", "dist-android\SalaryTimer-0.1.0-universal.apk")
foreach ($f in $apks) {
  & "$bt\apksigner.bat" sign --ks release.keystore --ks-pass pass:SalaryTimer2026 --key-pass pass:SalaryTimer2026 --v1-signing-enabled false --v2-signing-enabled true --v3-signing-enabled true $f
}

# C. ??(?? v1=false / v2=true / v3=true)
foreach ($f in $apks) {
  Write-Host "=== $f ==="; & "$bt\apksigner.bat" verify --verbose $f | Select-String "Verified using"
}
```

????:

```
Verified using v1 scheme (JAR signing): false
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): true
```

### Step 9 ? ??????

```powershell
Remove-Item dist-android\arm64-unsigned.apk, dist-android\universal-unsigned.apk, strip-arm64.cjs -Force -EA SilentlyContinue
```

---

## ?????? (dist-android/)

| ?? | ?? | ???? |
|------|------|---------|
| **SalaryTimer-0.1.0-arm64.apk** | **11.86 MB** | ?? ??,?? 99% ??(??/?? ?? arm64) |
| SalaryTimer-0.1.0-universal.apk | 35.38 MB     | ????? / x86 Android ??? / ???? |

### ????? (??????)
1. `package.json` ? `version` (??? x.y.z)
2. `src-tauri/tauri.conf.json` ? `version` (Gradle versionName ??)
3. `src-tauri/tauri.conf.json` ? `versionCode` (Android ?????,??????? **?? +1**)

---

## ?????????

| ?? | ?? | ???? |
|------|------|---------|
| jniLibs ???????? | Windows ?? + ???? | ???? jniLibs/build/target ? ? 4 ??? ? Step 5 HardLink .so |
| Gradle assemble ??? rustBuild ???? | Tauri Gradle ???? | ? 5 ? `-x :app:rustBuildXxxRelease` ??? |
| arm64 ? < 10 MB (????) | yazl ? .so ? DEFLATE ??? | `compress: !isSo`,.so ? STORE |
| ??? Android ????? | v1 JAR ??? zipalign ?? | ?? v1,?? v2+v3 |
| Android ?? LOGO ???? | adaptive icon fg ???? | manifest ? `android_fg_scale: 80` ?? |
| ?????? | ???????? tauri icon | ? System.Drawing ??? 1024?1024 ??? |
| Cannot find module yauzl | ???????? | ???????? |
| require is not defined (ESM ??) | package.json type=module ? .js ? ESM | ?????? `.cjs` |

---

## ?????? (?????? PowerShell,??????)

```powershell
cd d:\MyProject\work-timer
# 1 ??
npm run build
# 2 ?? jniLibs
Remove-Item src-tauri\gen\android\app\src\main\jniLibs -Recurse -Force -EA SilentlyContinue
Remove-Item src-tauri\gen\android\app\build            -Recurse -Force -EA SilentlyContinue
Remove-Item src-tauri\target                              -Recurse -Force -EA SilentlyContinue
$jr = "src-tauri\gen\android\app\src\main\jniLibs"
foreach ($a in @("arm64-v8a","armeabi-v7a","x86","x86_64")) { mkdir "$jr\$a" -Force | Out-Null }
# 3 Tauri build (Rust ?? .so; ?? symlink ??!)
npx tauri android build --apk 2>&1 | Select-Object -Last 20
# 4 HardLink so ? jniLibs
$tb="src-tauri\target"; $map=@{ "aarch64-linux-android"="arm64-v8a"; "armv7-linux-androideabi"="armeabi-v7a"; "i686-linux-android"="x86"; "x86_64-linux-android"="x86_64" };
foreach ($k in $map.Keys) { $s="$tb\$k\release\libapp_lib.so"; $d="$jr\$($map[$k])\libapp_lib.so"; if (Test-Path $s) { try { New-Item HardLink $d $s -Force -EA Stop | Out-Null } catch { Copy-Item $s $d -Force } } }
# 5 Gradle assemble (?? Rust)
cd src-tauri\gen\android
$env:ANDROID_HOME="C:\Users\admin\AppData\Local\Android\Sdk"; $env:JAVA_HOME="E:\environment\jdk17";
.\gradlew :app:assembleUniversalRelease -x ":app:rustBuildArm64Release" -x ":app:rustBuildArmRelease" -x ":app:rustBuildX86Release" -x ":app:rustBuildX86_64Release" -x ":app:rustBuildUniversalRelease" --no-daemon 2>&1 | Select-Object -Last 8
cd ..\..\..
# 6 arm64 ?? (? strip-arm64.cjs ???)
node strip-arm64.cjs
# 7 zipalign + sign
$bt = "C:\Users\admin\AppData\Local\Android\Sdk\build-tools\35.0.0"
& "$bt\zipalign.exe" -f 4 dist-android\arm64-unsigned.apk     dist-android\SalaryTimer-0.1.0-arm64.apk
& "$bt\zipalign.exe" -f 4 dist-android\universal-unsigned.apk dist-android\SalaryTimer-0.1.0-universal.apk
foreach ($f in @("dist-android\SalaryTimer-0.1.0-arm64.apk","dist-android\SalaryTimer-0.1.0-universal.apk")) { & "$bt\apksigner.bat" sign --ks release.keystore --ks-pass pass:SalaryTimer2026 --key-pass pass:SalaryTimer2026 --v1-signing-enabled false --v2-signing-enabled true --v3-signing-enabled true $f }
# 8 verify + clean
foreach ($f in @("dist-android\SalaryTimer-0.1.0-arm64.apk","dist-android\SalaryTimer-0.1.0-universal.apk")) { Write-Host "=== $f ==="; & "$bt\apksigner.bat" verify --verbose $f | Select-String "Verified using" }
Remove-Item dist-android\arm64-unsigned.apk, dist-android\universal-unsigned.apk, strip-arm64.cjs -Force -EA SilentlyContinue
Get-ChildItem dist-android\*.apk | Select-Object Name, @{N='MB';E={[math]::Round($_.Length/1MB,2)}}
```

---

*????: 2026-08-29 ? ?? Salary Timer v0.1.0 / Tauri 2.x / Windows 11*
