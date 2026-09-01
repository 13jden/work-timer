# Android APK 打包指南 · Salary Timer

> 环境: Windows 11 · Tauri 2.x · Rust 1.82+ · Android SDK build-tools 35 · JDK 17
> 当前版本: 1.3.4 (参见 tauri.conf.json 的 version)

---

## 环境准备

| 依赖 | 验证命令 / 路径 | 说明 |
|------|-------------------|------|
| Node.js ≥ 20 | `node --version` | 需能 `npm run build` |
| Rust stable | `rustup show` | 4 个 Android target |
| Tauri CLI | `npx tauri --version` | 2.x |
| JDK 17 | `E:\environment\jdk17` | Gradle 编译需要 17 |
| Android SDK | `C:\Users\admin\AppData\Local\Android\Sdk` | build-tools 35+ |

### 环境变量

```powershell
$env:ANDROID_HOME = "C:\Users\admin\AppData\Local\Android\Sdk"
$env:JAVA_HOME    = "E:\environment\jdk17"
```

### Rust Android targets (一次性)

    rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android

---

## 签名 Keystore (仅需创建一次 release.keystore)

| 参数 | 值 |
|------|---|
| keystore 文件 | `release.keystore` |
| alias | `salary-timer` (注意带连字符!) |
| storepass / keypass | `SalaryTimer2026` |
| 签名方案 | **v2 + v3 only** (禁用 v1 JAR 签名) |

创建命令:

```powershell
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -keystore release.keystore -alias salarytimer -keyalg RSA -keysize 2048 -validity 10000 -storepass SalaryTimer2026 -keypass SalaryTimer2026
```

---

## 图标生成 (含 Android Adaptive Icon 适配)

### 问题

直接 `npx tauri icon image/LS20260827102934.png` 生成的 Adaptive Icon 在圆形 mask 下会裁掉约 30% 的画面(安全区限制)，导致 LOGO 被裁切。

### 解决 (手动, 2026-08-29 实测可行)

**Step 1 · 裁剪正方形**: 用 System.Drawing 取 `min(W,H)` 居中裁剪(保证不变形)，输出 1024×1024·300 dpi 的 PNG，保存为 `src-tauri/icon-source.png`。

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

**Step 2 · manifest JSON (关键!控制缩放)**: 创建 `src-tauri/icon-manifest.json` 并设 `android_fg_scale: 80` 以预留安全区:

```json
{ "default": "icon-source.png", "android_fg_scale": 80 }
```

| android_fg_scale | 效果 |
|---|---|
| 100 (默认) | 铺满圆形 mask，LOGO 边角被裁 |
| 80 (推荐) | 四周留白 ~10%，LOGO 完整显示 |
| 70           | 留白更多，图标偏小 |

    cd src-tauri
    npx tauri icon icon-manifest.json
    cd ..

**Step 3**: tauri icon 会自动生成 adaptive-icon 文件(xml + png)，输出到 `src-tauri/gen/android/app/src/main/res/` 下 mipmap-* 和 drawable-anydpi-v26 目录，**无需手动操作**。

---

## 完整打包流程 (含 jniLibs symlink 替代方案)

### 核心问题 → Windows jniLibs 签名冲突 (必看!)

Tauri Gradle 构建会把 Rust .so 用 symlink 链接到 jniLibs/<arch> 下:
1. Windows 11 默认未开启开发者模式(普通权限)
2. 创建 symlink 需要管理员权限或特殊策略

报错示例: `New-Item : 无法创建指向 jniLibs/arm64-v8a 的链接，因为目标是不支持的类型!`

**解决方案: 提前清理 + 用 HardLink 替代:**

```powershell
Remove-Item src-tauri\gen\android\app\src\main\jniLibs -Recurse -Force -EA SilentlyContinue
Remove-Item src-tauri\gen\android\app\build            -Recurse -Force -EA SilentlyContinue
Remove-Item src-tauri\target                              -Recurse -Force -EA SilentlyContinue
$jr = "src-tauri\gen\android\app\src\main\jniLibs"
foreach ($a in @("arm64-v8a","armeabi-v7a","x86","x86_64")) { mkdir "$jr\$a" -Force | Out-Null }
```
### Step 1 · 构建前端

    npm run build   # 输出 dist/

### Step 2 · (可选) 仅构建 arm64 以加速

### Step 3 · 运行 Tauri Android 构建 + 准备 jniLibs 目录

### Step 4 · Tauri Android build --apk (Rust 编译 .so)

    npx tauri android build --apk

> 注意 **90% 的报错是 jniLibs 签名冲突**，此时 4 个架构的 Rust `.so` **已经编译完成**，
> 位于 `src-tauri/target/<triple>/release/libapp_lib.so`。**不要慌，直接 Step 5!**

### Step 5 · 用 HardLink 复制 .so 到 jniLibs

Windows symlink 有问题，改用硬链接(HardLink)无需特殊权限:

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

### Step 6 · Gradle assembleUniversalRelease (跳过 Rust 编译)

利用 `-x` 排除，Tauri Gradle 插件会尝试 rustBuild 任务，但我们已经手动处理了 symlink:

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

看到 **BUILD SUCCESSFUL** 后，unsigned APK 位于:

    src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk

### Step 7 · arm64 精简版 (35 MB → 12 MB，推荐)

目前 99% 的手机都是 arm64-v8a，去掉 lib/armeabi-v7a、lib/x86、lib/x86_64 可以大幅减小体积。

> **重要**: 不要用 yazl/yauzl 重新打包！会破坏 resources.arsc 的对齐，导致安装失败。
> 正确做法是用 `aapt remove` 直接删除不需要的架构文件，保留原始 APK 的对齐结构。

```powershell
$bt = "C:\Users\admin\AppData\Local\Android\Sdk\build-tools\35.0.0"
mkdir dist-android -Force | Out-Null
Copy-Item src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release-unsigned.apk dist-android\arm64-unsigned.apk -Force

# 用 aapt remove 删除其他架构的 .so
& "$bt\aapt.exe" remove dist-android\arm64-unsigned.apk `
  lib/armeabi-v7a/libapp_lib.so `
  lib/x86/libapp_lib.so `
  lib/x86_64/libapp_lib.so
```

### Step 8 · zipalign 对齐 + apksigner 签名 (最终产物!)

> 注意签名方案!使用 APK Signature Scheme v2+v3，build-tools 路径:
> `C:\Users\admin\AppData\Local\Android\Sdk\build-tools\35.0.0\`

```powershell
$bt = "C:\Users\admin\AppData\Local\Android\Sdk\build-tools\35.0.0"

# A. 4 字节对齐 zipalign
& "$bt\zipalign.exe" -f 4 dist-android\arm64-unsigned.apk     dist-android\SalaryTimer-0.1.0-arm64.apk
& "$bt\zipalign.exe" -f 4 dist-android\universal-unsigned.apk dist-android\SalaryTimer-0.1.0-universal.apk

# B. v2+v3 签名 (注意 --ks-key-alias salary-timer 带连字符!)
$apks = @("dist-android\SalaryTimer-0.1.0-arm64.apk", "dist-android\SalaryTimer-0.1.0-universal.apk")
foreach ($f in $apks) {
  & "$bt\apksigner.bat" sign --ks release.keystore --ks-key-alias salary-timer --ks-pass pass:SalaryTimer2026 --key-pass pass:SalaryTimer2026 --v1-signing-enabled false --v2-signing-enabled true --v3-signing-enabled true $f
}

# C. 验证(确认 v1=false / v2=true / v3=true)
foreach ($f in $apks) {
  Write-Host "=== $f ==="; & "$bt\apksigner.bat" verify --verbose $f | Select-String "Verified using"
}
```

预期输出:

```
Verified using v1 scheme (JAR signing): false
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): true
```

### Step 9 · 清理临时文件

```powershell
Remove-Item dist-android\arm64-unsigned.apk, dist-android\universal-unsigned.apk, strip-arm64.cjs -Force -EA SilentlyContinue
```

---

## 最终产物 (dist-android/)

| 文件 | 大小 | 说明 |
|------|------|------|
| **SalaryTimer-1.3.4-arm64.apk** | **11.59 MB** | 推荐，覆盖 99% 手机(仅含 arm64) |

> 产物命名规则:`SalaryTimer-<version>-arm64.apk`，version 与 tauri.conf.json 一致。

### 发版前检查清单 (每次必做)
1. `src-tauri/tauri.conf.json` 的 `version` (Gradle versionName 来源，格式 x.y.z)
2. 产物文件名同步更新版本号
3. 桌面窗口尺寸如需调整，保持宽高比 ≥ 1.5 (见下文桌面端 EXE 打包)

---

## 桌面端 EXE 打包 (v1.3.4 实测)

> **注意**:沙箱环境下 `npx tauri build` 的 WiX 打包步骤会报「拒绝访问」
> (需写 `C:\Users\admin\AppData\Local\tauri`)，因此用 `--no-bundle` 只产出 exe，
> Rust 编译完成后手动复制即可。

```powershell
npx tauri build --no-bundle
Copy-Item src-tauri\target\release\app.exe dist-desktop\SalaryTimer.exe -Force
```

### 窗口默认配置 (tauri.conf.json)

| 字段 | 值 | 说明 |
|------|-----|------|
| width × height | 1120 × 720 | 比例 1.56 ≥ 1.5，打开即桌面端布局 |
| minWidth × minHeight | 900 × 600 | 比例下限 1.5，缩到最小也不进移动端布局 |

> 桌面/移动端布局由 JS `useIsDesktop()` 按宽高比 ≥ 3/2 判断，
> 窗口配置必须保证默认与最小尺寸都 ≥ 1.5，否则 EXE 打开会是移动端界面。

---

## 常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| jniLibs 签名冲突报错 | Windows 权限 + symlink 限制 | 提前清理 jniLibs/build/target → 重建 4 个空目录 → Step 5 HardLink .so |
| Gradle assemble 报 rustBuild 任务失败 | Tauri Gradle 插件默认行为 | 加 5 个 `-x :app:rustBuildXxxRelease` 排除 |
| **安装失败/解析错误** | **yazl 重新打包破坏 resources.arsc 对齐** | **用 `aapt remove` 删除架构，不要用 yazl/yauzl 重新打包!** |
| arm64 APK > 10 MB (体积异常) | .so 被 DEFLATE 压缩 | `aapt remove` 保留原始压缩方式 |
| Android 桌面 LOGO 被裁切 | adaptive icon fg 图片太大 | manifest 里设 `android_fg_scale: 80` 缩小 |
| 图标模糊/锯齿 | 原始图片分辨率不够 | 用 System.Drawing 裁剪 1024×1024 高清图 |

---

## 打包注意点 (踩坑记录)

> 以下为 2026-08-31 实测踩坑总结，每条都对应一次真实失败。

### 1. Keystore alias 带连字符

实际 keystore 中的 alias 是 `salary-timer`（带连字符），不是 `salarytimer`。
用 `keytool -list` 确认:

```powershell
& "$env:JAVA_HOME\bin\keytool.exe" -list -keystore release.keystore -storepass SalaryTimer2026
```

apksigner 签名时也需要用 `--ks-key-alias salary-timer`:

```powershell
& "$bt\apksigner.bat" sign --ks release.keystore --ks-key-alias salary-timer --ks-pass pass:SalaryTimer2026 ...
```

### 2. 绝对不要用 yazl/yauzl 重新打包 APK

用 Node.js 的 yazl/yauzl 重新打包会破坏 `resources.arsc` 的 4 字节对齐（STORE → DEFLATE），
导致 Android 安装失败（解析错误）。

**正确做法**: 用 `aapt remove` 直接从原始 APK 中删除不需要的文件，保留原始对齐结构:

```powershell
& "$bt\aapt.exe" remove dist-android\arm64-unsigned.apk `
  lib/armeabi-v7a/libapp_lib.so lib/x86/libapp_lib.so lib/x86_64/libapp_lib.so
```

### 3. 签名顺序: 先 zipalign，再 apksigner

`apksigner` 的 v2/v3 签名会校验 APK 的字节对齐，如果先签名再 zipalign，zipalign 会破坏签名。
正确顺序:

```
unsigned APK → zipalign → apksigner → 最终 APK
```

### 4. apksigner 的 v1 签名在 targetSdk 36 下无效

即使设置 `--v1-signing-enabled true`，apksigner 在 targetSdk ≥ 36 时也会自动跳过 v1 JAR 签名。
这是 Android 的设计行为，不是 bug。

- Target SDK 36 要求至少 v2 签名
- v2 + v3 覆盖 Android 7.0+（2016 年后的所有设备）
- 如需兼容 Android 6.0 及以下，需降低 targetSdk（但会影响 Google Play 上架）

### 5. resources.arsc 必须是 STORE 模式

`resources.arsc` 文件必须保持未压缩（STORE），否则 Android 无法解析 APK。
验证方法:

```powershell
& "$bt\zipalign.exe" -c -v 4 your.apk | Select-String "resources.arsc"
# 期望输出: resources.arsc (OK)
# 如果显示: resources.arsc (BAD) → 安装会失败!
```

### 6. 精简后的 APK 体积参考

| 方式 | arm64 APK 大小 | 说明 |
|------|---------------|------|
| aapt remove (推荐) | ~11.6 MB | 保留原始对齐，安装正常 |
| yazl 重新打包 (禁止) | ~10.9 MB | 看起来更小，但 resources.arsc 被压缩，安装失败 |

---

## 一键打包脚本 (适合 PowerShell，复制即用)

```powershell
cd d:\MyProject\work-timer
# 1 构建前端
npm run build
# 2 清理 jniLibs
Remove-Item src-tauri\gen\android\app\src\main\jniLibs -Recurse -Force -EA SilentlyContinue
Remove-Item src-tauri\gen\android\app\build            -Recurse -Force -EA SilentlyContinue
Remove-Item src-tauri\target                              -Recurse -Force -EA SilentlyContinue
$jr = "src-tauri\gen\android\app\src\main\jniLibs"
foreach ($a in @("arm64-v8a","armeabi-v7a","x86","x86_64")) { mkdir "$jr\$a" -Force | Out-Null }
# 3 Tauri 构建 (Rust 编译 .so; 可能 symlink 报错，忽略!)
npx tauri android build --apk 2>&1 | Select-Object -Last 20
# 4 HardLink so 到 jniLibs
$tb="src-tauri\target"; $map=@{ "aarch64-linux-android"="arm64-v8a"; "armv7-linux-androideabi"="armeabi-v7a"; "i686-linux-android"="x86"; "x86_64-linux-android"="x86_64" };
foreach ($k in $map.Keys) { $s="$tb\$k\release\libapp_lib.so"; $d="$jr\$($map[$k])\libapp_lib.so"; if (Test-Path $s) { try { New-Item HardLink $d $s -Force -EA Stop | Out-Null } catch { Copy-Item $s $d -Force } } }
# 5 Gradle assemble (跳过 Rust)
cd src-tauri\gen\android
$env:ANDROID_HOME="C:\Users\admin\AppData\Local\Android\Sdk"; $env:JAVA_HOME="E:\environment\jdk17";
.\gradlew :app:assembleUniversalRelease -x ":app:rustBuildArm64Release" -x ":app:rustBuildArmRelease" -x ":app:rustBuildX86Release" -x ":app:rustBuildX86_64Release" -x ":app:rustBuildUniversalRelease" --no-daemon 2>&1 | Select-Object -Last 8
cd ..\..\..
# 6 arm64 精简 (用 aapt remove，不要用 yazl!)
$bt = "C:\Users\admin\AppData\Local\Android\Sdk\build-tools\35.0.0"
mkdir dist-android -Force | Out-Null
Copy-Item src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release-unsigned.apk dist-android\arm64-unsigned.apk -Force
& "$bt\aapt.exe" remove dist-android\arm64-unsigned.apk lib/armeabi-v7a/libapp_lib.so lib/x86/libapp_lib.so lib/x86_64/libapp_lib.so
# 7 zipalign + sign
& "$bt\zipalign.exe" -f 4 dist-android\arm64-unsigned.apk     dist-android\SalaryTimer-0.1.0-arm64.apk
& "$bt\zipalign.exe" -f 4 dist-android\universal-unsigned.apk dist-android\SalaryTimer-0.1.0-universal.apk
foreach ($f in @("dist-android\SalaryTimer-0.1.0-arm64.apk","dist-android\SalaryTimer-0.1.0-universal.apk")) { & "$bt\apksigner.bat" sign --ks release.keystore --ks-key-alias salary-timer --ks-pass pass:SalaryTimer2026 --key-pass pass:SalaryTimer2026 --v1-signing-enabled false --v2-signing-enabled true --v3-signing-enabled true $f }
# 8 verify + clean
foreach ($f in @("dist-android\SalaryTimer-0.1.0-arm64.apk","dist-android\SalaryTimer-0.1.0-universal.apk")) { Write-Host "=== $f ==="; & "$bt\apksigner.bat" verify --verbose $f | Select-String "Verified using" }
Remove-Item dist-android\arm64-unsigned.apk, dist-android\universal-unsigned.apk, strip-arm64.cjs -Force -EA SilentlyContinue
Get-ChildItem dist-android\*.apk | Select-Object Name, @{N='MB';E={[math]::Round($_.Length/1MB,2)}}
```

---

*最后更新: 2026-08-31 · 补充打包踩坑记录 (aapt remove 替代 yazl / alias 修正 / 签名顺序)*
