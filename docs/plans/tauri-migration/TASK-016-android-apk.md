# TASK-016 · Android APK 构建 + 签名 + 自定义 Logo

> 状态:✅ 完成(2026-08-29)
> 依赖:TASK-015(Tauri Mobile + Android target 配置,用户已手动完成)
> 创建:2026-08-29

---

## 目标

用自定义 logo(`image/LS20260827102934.png`,柠檬绿 ¥ 秒表)替换 Tauri 默认图标,
重新构建 Android release universal APK,并签名产出**可直接安装**的 APK。

## 背景

- 用户已手动配置环境:Rust 1.98 + 四个 Android target、JDK 21、NDK 29、Android SDK(compileSdk 36)
- `src-tauri/gen/android` 已初始化,2026-08-28 已产出 `app-universal-release-unsigned.apk`(未签名,不可直接安装)
- 当前图标为 Tauri 默认图标,需替换为自定义 logo

## 步骤

1. **logo 方形化**:原图 1228×1225 非正方形,`tauri icon` 要求正方形 ≥1024。
   用 System.Drawing 以背景色补边到 1228×1228,存 `resources/logo-square.png`。
2. **生成图标**:`npx tauri icon resources/logo-square.png`
   → 重写 `src-tauri/icons/`(ico / icns / png / Square*)+ `icons/android/` mipmap 全套。
3. **同步 Android 图标**:把 `icons/android/mipmap-*` 覆盖到
   `src-tauri/gen/android/app/src/main/res/mipmap-*/`
   (ic_launcher.png / ic_launcher_round.png / ic_launcher_foreground.png)。
4. **构建**:`npx tauri android build --apk`(release universal,四架构)。
5. **签名**:
   - `keytool` 生成 `release.keystore`(RSA 2048,有效期 27 年,存项目根,加入 .gitignore)
   - `zipalign -f 4` 对齐 → `apksigner sign` 签名 → `apksigner verify` 校验
6. **产物**:最终 APK 复制到 `dist-android/SalaryTimer_<version>_universal.apk`。

## 出口标准

- [x] `src-tauri/icons/` 全部为自定义 logo 派生
- [x] Android res mipmap 同步完成
- [x] `apksigner verify` 通过,APK 可 `adb install`
- [x] CHANGELOG 追加记录

## 备注

- keystore 密码见 `keystore.properties`(已 gitignore,**勿提交**)
- 上架 Play Store 需另行处理签名与账号(TASK-021),本任务只保证侧载安装
