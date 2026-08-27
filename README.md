# 今日出售时间 · Salary Timer

> "打工人的浪漫,是看着钱一秒一秒进账。"

一个手机端的**实时薪资计时器**。打开 App,看着今天已经赚了多少、每秒钟挣多少,以及一杯咖啡要工作多久才买得起。所有数据存本地,不上云、不注册、不联网。

---

## 功能

### 今日 (Today)
实时显示"今天已经赚到了多少钱"。从上班到下班,金额随秒针实时累加,精确到分。下方两个速率:
- **小时工资**:¥X / 小时
- **每秒工资**:¥X / 秒(精确到小数点后 4 位)

### 换算 (Swap)
把工作时间等价换算成消费,例如:
- ☕ 咖啡 ☕ 奶茶 ☕ 球鞋
设置每项商品的价格,App 自动告诉你"工作 X 小时 X 分钟 X 秒才买得起"。

### 日历 (Calendar)
- 查看**任何月份**的工作日和收入(过去:已落袋;当前:实时)
- 点击任意一天可**手动切换工作日/休息日**(覆盖节假日判断,适合调休)
- 显示当月工作日数、当月累计收入

### 设置 (Settings)
- **月薪** — 月薪总额
- **当月工作日** — 自动根据日历算出(去掉周末和内置节假日)
- **上班时间 / 下班时间 / 午休时长** — 决定每日工作秒数
- **咖啡单价** — 换算页商品默认值

---

## 工作日算法

每月**自动**计算当月工作日数(剔除周末 + 内置中国大陆节假日)。日薪 = 月薪 ÷ 当月工作日。

- **今日/换算页**:永远使用"当前月"工作日
- **日历页**:看哪个月就用哪个月的工作日(上月23天 → 除23;本月21天 → 除21)
- **手动调休**:日历点某天 → "切换为休息日/工作日",覆盖系统判定

这样无论几月、几天,日薪都按真实工作日算,不会因为春节、国庆多休几天而虚高。

---

## 直接用浏览器打开

零依赖,纯静态。**双击 `index.html`** 即可,所有数据保存在浏览器 `localStorage`,无需服务器。

---

## 打包成 Android APK

工程已用 [Capacitor](https://capacitorjs.com) 包装好,WebView 直接加载 `www/index.html`。

### 一次性环境

| 工具 | 版本 | 说明 |
|---|---|---|
| JDK | **21** (LTS) | Capacitor 8 强制要求 source 21 |
| Android cmdline-tools | 任何 12+ 版本 | `sdkmanager` 装组件 |
| Node.js | 18+ | 跑 `npx cap` |

并装好这些 SDK 组件:
```bash
sdkmanager "platform-tools" "platforms;android-34" "platforms;android-36" "build-tools;34.0.0" "build-tools;36.0.0"
```

设置环境变量(用户级):
```
JAVA_HOME=E:\environment\jdk21
ANDROID_HOME=D:\Android\Sdk
```

### 出 debug APK(给自己装)

```powershell
# 1. 同步 web 资源到 Android 工程(改完 index.html 后必跑)
Copy-Item index.html www\index.html -Force
npx cap copy android

# 2. 构建 APK
cd android
.\gradlew assembleDebug

# 3. 产物
# android\app\build\outputs\apk\debug\app-debug.apk
```

把 `app-debug.apk` 拷到手机点击安装即可(需打开"未知来源")。debug 包用 Android 默认签名,无法上架商店,自用没问题。

### 出 release APK(可分发)

1. 生成签名 keystore:
   ```powershell
   keytool -genkey -v -keystore worktimer.keystore -alias worktimer -keyalg RSA -keysize 2048 -validity 10000
   ```
2. 在 `android/gradle.properties` 末尾加:
   ```
   WORKTIMER_STORE_FILE=worktimer.keystore
   WORKTIMER_STORE_PASSWORD=你的密码
   WORKTIMER_KEY_ALIAS=worktimer
   WORKTIMER_KEY_PASSWORD=你的密码
   ```
3. 跑:
   ```powershell
   cd android
   .\gradlew assembleRelease
   # 产物:android\app\build\outputs\apk\release\app-release.apk
   ```

### 一键打包脚本

仓库根的 `build-apk.ps1` 把上面的"同步 + 构建"打包成一条命令:
```powershell
.\build-apk.ps1
```

---

## 国内网络优化

如果在国内构建失败/慢,工程已配置国内镜像:
- `android/gradle/wrapper/gradle-wrapper.properties` → Gradle 走腾讯云镜像
- `android/build.gradle` → Maven 仓库走阿里云

若海外网络通畅,直接删除以上镜像回退到 google()/mavenCentral()。

---

## 目录结构

```
.
├── index.html              ← 你编辑的唯一源文件(单文件全功能)
├── www/index.html          ← Capacitor webDir,与 index.html 保持同步
├── image/                  ← 应用图标源图(用于 capacitor-assets 生成)
├── resources/              ← 同上
├── build-apk.ps1           ← 一键构建脚本
├── capacitor.config.json
├── package.json
├── README.md
└── android/                ← Capacitor 生成的原生 Android 工程
```

**单一 HTML 源** —— 所有逻辑、样式、视图都在 `index.html` 里,改一处即可生效。改完跑 `.\build-apk.ps1` 重新打包。

---

## 已知限制

- 字体(Instrument Serif / Inter Tight / JetBrains Mono)走 Google Fonts CDN,首屏需联网;离线时回退到系统字体
- localStorage 在卸载 APP 后会清空(浏览器版则不会),目前没有云同步
- 内置节假日是写死的中国法定假日表,需要每年手动更新(可以在 `HOLIDAYS` 常量里改)

---

## 许可

仅供个人自用,源码可见,但**不保证**无 bug。