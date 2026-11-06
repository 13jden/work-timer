# TASK-066 · v3.1 Android APK 重打包

**状态**：已实现（待验收）
**版本**：v3.1
**范围**：打包链路（不改业务代码）

## 背景

v3.1 完成了 TASK-063（一程命名重写 + 列表/详情 UI 重设计）、TASK-064（MINE 页布局重排）、
TASK-065（统计页汇总带重设计）三个改动，但可安装的 APK 仍停留在 v3.0.0，
用户装机后看不到 v3.1 的任何改动。

`src-tauri/tauri.conf.json` 的 `version` 也一直停在 `3.0.0`，
Gradle 读它作为 `versionName`，导致即使重新打包，安装后显示的版本号仍是 3.0.0。

## 范围

**只做打包，不动业务代码**：

1. `src-tauri/tauri.conf.json` 的 `version`：`3.0.0` → `3.1.0`
2. 修复 `src-tauri/gen/android/local.properties` 的 `ndk.dir` 路径
3. 按 `docs/ANDROID-APK-PACKAGING.md` 流程产出 arm64 APK 并签名
4. 同步下载页产物：`public/downloads/` + `public/download/index.html`

## 打包中遇到的两个新问题

### 1. `local.properties` 的 `ndk.dir` 反斜杠被 Java 吞掉

原值：

```properties
ndk.dir=C:\Users\admin\AppData\Local\Android\ndk\29.0.13846066
```

Java `.properties` 里 `\` 是转义符，`\U` `\n` `\2` 全部被丢弃，
实际读到的路径变成 `C:UsersadminAppDataLocalAndroidndk29.0.13846066`，
Gradle 报：

```
[CXX1102] Location specified by ndk.dir (C:UsersadminAppDataLocalAndroid
ndk29.0.13846066) did not contain a valid NDK and couldn't be used
```

同文件里的 `sdk.dir` 写成双反斜杠（`C:\\Users\\...`）才是对的，
但 `ndk.dir` 漏了。**修法：统一用正斜杠**，两种都合法且不再有转义歧义：

```properties
ndk.dir=C:/Users/admin/AppData/Local/Android/ndk/29.0.13846066
```

### 2. `abiFilters` 已经限定 arm64，不需要再做 `aapt remove`

`src-tauri/gen/android/app/build.gradle.kts` 的 `defaultConfig` 里有：

```kotlin
ndk { abiFilters += listOf("arm64-v8a") }
```

所以 `--target aarch64` 构建出来的 APK **本来就只含 arm64**，
`aapt list` 实测只有 `lib/arm64-v8a/libapp_lib.so` 一项。
打包指南里的「Step 7 arm64 精简（aapt remove）」属于历史流程（当时 `abiFilters` 还没限定），
现在跑 `aapt remove` 只会报「找不到要删除的文件」。

**结论**：本任务直接 `--target aarch64` 出包，省掉精简步骤。

## 打包命令（实测可用）

```powershell
# 1 前端（必须 build:tauri，避免旧 APK 被嵌进 .so）
npm run build:tauri

# 2 Tauri Android 构建（Rust 编译 .so + Gradle 打包）
$env:ANDROID_HOME="C:\Users\admin\AppData\Local\Android\Sdk"
$env:JAVA_HOME="E:\environment\jdk17"
npx tauri android build --apk --target aarch64 --ci

# 3 zipalign + apksigner（v2/v3，不生成 v1）
$bt="C:\Users\admin\AppData\Local\Android\Sdk\build-tools\35.0.0"
$src="src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release-unsigned.apk"
& "$bt\zipalign.exe" -f 4 $src "dist-android\SalaryTimer-3.1.0-arm64.apk"
& "$bt\apksigner.bat" sign --ks release.keystore --ks-key-alias salary-timer `
  --ks-pass pass:SalaryTimer2026 --key-pass pass:SalaryTimer2026 `
  --v1-signing-enabled false --v2-signing-enabled true --v3-signing-enabled true `
  "dist-android\SalaryTimer-3.1.0-arm64.apk"
& "$bt\apksigner.bat" verify --verbose "dist-android\SalaryTimer-3.1.0-arm64.apk"
```

> 本次 symlink 居然成功了（`jniLibs/arm64-v8a/libapp_lib.so` 是 SymbolicLink），
> 推测是 Windows 开发者模式或当前会话权限已放开。
> 如果再次报「此操作需要管理员权限」，回退到打包指南里的 HardLink 方案。

## 产物

| 文件 | 大小 | 说明 |
|---|---|---|
| `dist-android/SalaryTimer-3.1.0-arm64.apk` | 11.71 MB | arm64-v8a only，v2+v3 签名 |
| `public/downloads/SalaryTimer-3.1.0-arm64.apk` | 11.71 MB | 网站下载页用 |

- versionName：`3.1.0`（`aapt dump badging` 确认）
- versionCode：`3001000`
- minSdk 24 / targetSdk 36
- sha256：`27ba8339b7232a30b1e907b23d41ce2fa81e7f184bbd3baa492d5d47f1bc748e`
- `apksigner verify`：v1=false / v2=true / v3=true
- `zipalign -c -v 4`：`resources.arsc (OK)`
- 包内 `assets/tauri.conf.json` 的 `version` = `3.1.0`，
  前端 bundle 指纹 `index-CYCZlyak.js` / `index-CCANJ6vg.css` 与本次 `build:tauri` 产物一致，
  确认 v3.1 前端已嵌入

## 验收

- [ ] `npm run typecheck` 通过 ✅
- [ ] `npm run test` 470 / 470 通过 ✅
- [ ] `npm run build` 成功 ✅
- [ ] `apksigner verify` v2+v3 ✅
- [ ] `resources.arsc` 对齐 ✅
- [ ] **真机安装运行（待用户在手机 / 模拟器上验证）**

## 变更清单

| 文件 | 变更 |
|---|---|
| `src-tauri/tauri.conf.json` | `version` 3.0.0 → 3.1.0 |
| `src-tauri/gen/android/local.properties` | `ndk.dir` 改正斜杠（本地文件，gitignore） |
| `public/download/index.html` | 版本号 / 日期 / 下载链接 → 3.1.0 |
| `public/downloads/manifest.json` | 版本 / 日期 / sha256 / size → 3.1.0 |
| `public/downloads/SalaryTimer-3.0.0-arm64.apk` | 删除（换成 3.1.0） |
| `public/downloads/SalaryTimer-3.1.0-arm64.apk` | 新增 |
| `docs/ANDROID-APK-PACKAGING.md` | 补 ndk.dir 转义坑 + 修正 arm64 精简流程 |

---

*创建于 2026-11-04 · v3.1 APK 重打包*
