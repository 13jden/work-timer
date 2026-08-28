# TASK-006 · 迁移日历页 + 日期 sheet

| 字段 | 值 |
|---|---|
| **阶段** | 阶段 1:React 重写 |
| **估时** | 0.5 天 |
| **依赖** | TASK-004 |
| **优先级** | P2 |
| **状态** | ✅ 已完成(2026-08-28) |

---

## 1. 目标

迁移 `#page-calendar`(日历页),包括:
- 月度工作日网格
- 上 / 下月切换
- 点击日期 → DaySheet 弹出,可切换工作 / 休息
- 顶部 summary:工作日数、日均、已赚

---

## 2. 验收标准

- [ ] `src/pages/CalendarPage.tsx`
- [ ] `src/components/MonthGrid/`(月份网格)
- [ ] `src/components/DaySheet/`(日期 sheet)
- [ ] 上 / 下月按钮 + 当前月显示
- [ ] 每天显示日期数字 + 日薪(或 "休息")
- [ ] 今天的日期高亮
- [ ] 点击日期打开 DaySheet:
  - 显示该日详情(日期、类型、日薪)
  - "切换为休息日 / 工作日" 按钮
  - "重置" 按钮(清除手动 override)
- [ ] `docs/CHANGELOG.md` 追加变更

---

## 3. 组件结构

```
src/pages/CalendarPage.tsx

src/components/
├── MonthGrid/
│   ├── MonthGrid.tsx
│   ├── MonthGrid.module.css
│   └── index.ts
└── DaySheet/
    ├── DaySheet.tsx
    ├── DaySheet.module.css
    └── index.ts
```

---

## 4. 关键逻辑

### 月份状态管理

```ts
// src/store/calendarStore.ts
interface CalendarStore {
  year: number;
  month: number;
  setMonth: (year: number, month: number) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  goToToday: () => void;
}
```

### 网格渲染

```tsx
export function MonthGrid({ year, month }: { year: number; month: number }) {
  const config = useConfigStore();
  const overrides = useCalendarStore(s => s.overrides);
  const holidays = HOLIDAYS;

  const days = daysInMonthCalc(year, month);
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sunday

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null); // padding
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d);
    const isWork = isWorkday(date, config, overrides, holidays);
    const isToday = isSameDay(date, new Date());
    cells.push({ date: d, isWork, isToday });
  }

  return <div className={styles.grid}>...</div>;
}
```

---

## 5. DaySheet 设计

```tsx
interface DaySheetProps {
  open: boolean;
  date: Date | null;
  onClose: () => void;
  onToggle: () => void;        // 切换 work/rest
  onReset: () => void;         // 清除 override
}
```

---

## 6. 操作步骤

1. 复制 `src/styles/page-calendar.css` 样式
2. 创建 `MonthGrid` 组件
3. 创建 `DaySheet` 组件(可复用 TASK-005 的 sheet 动画)
4. 创建 `CalendarPage`
5. 接入 `calendarStore` + `configStore`
6. 测试月份切换、日期点击、override 操作
7. 更新 `docs/CHANGELOG.md`

---

## 7. 不要做的事

- ❌ 不要在网格里显示农历(超出 MVP 范围)
- ❌ 不要做节日高亮(目前节假日仅用于判定)

---

## 8. 完成提交信息

```
feat(calendar): migrate Calendar page with month grid and day sheet

- Componentize MonthGrid, DaySheet
- Wire calendarStore for month navigation
- Wire dayOverrides for work/rest toggling
- Update CHANGELOG.md
```

---

*创建于 2026-08-28*