# Architecture · Salary Timer

## Overview

**Salary Timer** converts working time into real-time money — a live salary counter that makes your hourly rate tangible and visceral.

Target: working professionals who want to feel the value of their time.
Single HTML file, no build step. Capacitor-wrapped for Android.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS, single file |
| Mobile | Capacitor 7, Android 36 |
| Build | Vite (web dev), `cap copy` → Android |
| Fonts | Google Fonts (Instrument Serif, Inter Tight, JetBrains Mono) |
| Storage | `localStorage` — no server, no backend |
| Theme | CSS custom properties (3 built-in themes) |

---

## Data Model (localStorage)

All data lives in `localStorage`. No encryption, no cloud sync.

| Key | Type | Description |
|---|---|---|
| `salary_timer_config_v1` | Object | User settings (salary, hours, rest mode, theme) |
| `salary_timer_items_v1` | Array | Convert page item list |
| `salary_timer_day_overrides_v1` | Object | Manual work/rest overrides keyed `YYYY-MM-DD` |
| `salary_timer_monthly_v1` | Object | Monthly salary records keyed `YYYYMM` |

### Config schema (`salary_timer_config_v1`)

```ts
interface Config {
  monthlySalary: number      // e.g. 15000
  startTime: string         // "HH:MM", e.g. "09:00"
  endTime: string           // "HH:MM", e.g. "18:00"
  lunchBreak: number         // hours, e.g. 1
  coffeePrice: number        // ¥ per cup, e.g. 15
  restMode: 0 | 1 | 2      // 0=无休, 1=单休, 2=双休 (default)
  lunchRest: boolean        // whether lunch counts as non-working time
  theme: string             // theme ID, e.g. "paper" | "dark" | "gold"
}
```

### Day override schema (`salary_timer_day_overrides_v1`)

```ts
// key format: "YYYY-MM-DD"
{ "2026-08-27": "work" | "rest" }
```

### Monthly record schema (`salary_timer_monthly_v1`)

```ts
// key format: number, e.g. 202608
interface MonthlyRecord {
  yyyy: number
  mm: number
  salary: number       // monthly salary at time of generation
  workDays: number    // work days in that month
  dailyRate: number   // salary / workDays
  hourlyRate: number  // dailyRate / workHours
  totalEarned: number
  locked: boolean     // true = finalized, false = current month (live)
  generatedAt: string // ISO date string
}
```

---

## Page Architecture

Four-tab SPA inside one HTML file. Tab state managed via CSS classes.

```
Device Frame
├── Status Bar          ← live clock
├── Pages
│   ├── #page-today    ← live timer + progress + income
│   ├── #page-convert  ← item × hourly-rate conversions
│   ├── #page-calendar ← month grid + workday summary
│   └── #page-settings ← config form + monthly history
└── Dock               ← 4-tab bottom navigation
```

---

## Computation Logic

### Work seconds per day
```
workSeconds = max((toMinutes(endTime) - toMinutes(startTime)) - lunchBreak * 60, 0) * 60
```

### Workdays in month
```
isWorkday(date):
  if manual override → use override
  if holiday → false
  if restMode == 0 (无休) → true
  if restMode == 1 (单休) → dayOfWeek != Sunday
  if restMode == 2 (双休) → dayOfWeek not in {Saturday, Sunday}
```

### Daily / hourly rate
```
dailyRate  = monthlySalary / workdaysInMonth
hourlyRate = dailyRate / (workSeconds / 3600)
perSecond  = hourlyRate / 3600
```

### Today earned
```
if not workday → 0
if nowM <= startM → 0
if nowM >= endM → dailyRate
otherwise: workedMin = nowM - startM, subtract lunch overlap → earned = perSecond * workedMin * 60
```

### Progress bar
```
totalWorkMins = (endM - startM) - lunchBreak * 60
progress = clamp((nowM - startM) / totalWorkMins, 0, 1) × 100%
```

---

## Build & Release

### Dev (web only)
```
npx vite
```

### Capacitor sync
```
npx cap copy android
```

### Build APK
```
cd android
gradlew assembleDebug
# output: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Theme System

Three built-in themes. Stored in `config.theme`. Applied via `data-theme` attribute on `<html>`.

| Theme | Description |
|---|---|
| `paper` | Warm cream (#F5F2EA) + acid yellow-green (#C8FF00) + dark (#0F0F0F) |
| `dark` | Near-black (#0F0F0F) + electric blue (#4DABF7) + cyan (#22D3EE) |
| `gold` | Off-white (#FAF9F6) + antique gold (#D4A843) + warm charcoal (#2A2520) |

Each theme defines CSS custom properties on `[data-theme="X"]`:
`--ink`, `--ink-2`, `--ink-3`, `--accent`, `--accent-deep`, `--accent-shadow`, `--paper`, `--paper-2`, `--card`, `--line`, `--line-soft`, `--muted`, `--muted-2`.

---

## Version History

See [CHANGELOG.md](./CHANGELOG.md)
