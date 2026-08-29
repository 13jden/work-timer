/**
 * SettingsPage — 设置页(Mine)
 *
 * 布局匹配 index.html:
 *   page-head (Preferences / 设置)
 *   薪资 · Salary   → 月薪 + 当月工作日
 *   时间 · Hours    → 上班 + 下班 + 每周休息
 *   换算 · Convert  → 咖啡默认单价
 *   主题 · Theme    → 配色圆点
 *   月度记录 · Salary History → 快照列表
 *   footer → v本地存储
 */
import { useMemo } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { useThemeStore, THEME_LIST } from '../store/themeStore';
import { useMonthlyStore } from '../store/monthlyStore';
import { HOLIDAYS } from '../lib/constants';
import { workdaysInMonth } from '../lib/compute';
import { useNow } from '../hooks/useNow';
import styles from './SettingsPage.module.css';

const MONTH_NAMES_CN = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

export function SettingsPage() {
  const config = useConfigStore();
  const setConfig = useConfigStore((s) => s.setConfig);
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const setTheme = useThemeStore((s) => s.setTheme);
  const getAllSnapshots = useMonthlyStore((s) => s.getAllSnapshots);
  const now = useNow(60_000);

  const workdays = useMemo(
    () => workdaysInMonth(now.getFullYear(), now.getMonth(), config, overrides, HOLIDAYS),
    [now, config, overrides],
  );

  const snapshots = useMemo(() => {
    const list = getAllSnapshots();
    // newest first (key = YYYY-MM string → localeCompare desc)
    return list.slice().sort((a, b) => b.key.localeCompare(a.key));
  }, [getAllSnapshots]);

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <>

      {/* ═══ page-head ═══ (匹配 index.html Preferences / 设置) */}
      <div className={styles.pageHead}>
        <div className={styles.eyebrow}>Preferences</div>
        <h2 className={styles.pageTitle}>设置</h2>
      </div>

      {/* ═══ 薪资 · Salary ═══ */}
      <div className={styles.group}>
        <div className={styles.groupEyebrow}>薪资 · Salary</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.label}>月薪</span>
            <span className={styles.value}>
              <span className={styles.prefix}>¥</span>
              <input
                type="number"
                className={styles.input}
                value={config.monthlySalary}
                onChange={(e) => setConfig({ monthlySalary: Number(e.target.value) })}
                min={0}
              />
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>当月工作日</span>
            <span className={styles.value}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)', fontSize: 13 }}>
                {workdays}
              </span>
              <span className={styles.suffix}>天</span>
            </span>
          </div>
        </div>
      </div>

      {/* ═══ 时间 · Hours ═══ */}
      <div className={styles.group}>
        <div className={styles.groupEyebrow}>时间 · Hours</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.label}>上班时间</span>
            <span className={styles.value}>
              <input
                type="time"
                className={styles.input}
                value={config.startTime}
                onChange={(e) => setConfig({ startTime: e.target.value })}
                style={{ width: 90, textAlign: 'right' }}
              />
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>下班时间</span>
            <span className={styles.value}>
              <input
                type="time"
                className={styles.input}
                value={config.endTime}
                onChange={(e) => setConfig({ endTime: e.target.value })}
                style={{ width: 90, textAlign: 'right' }}
              />
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>休息模式</span>
            <span className={styles.value}>
              <select
                className={styles.select}
                value={config.restMode}
                onChange={(e) => setConfig({ restMode: Number(e.target.value) as 0 | 1 | 2 })}
              >
                <option value={0}>无休</option>
                <option value={1}>单休</option>
                <option value={2}>双休</option>
              </select>
              <span className={styles.chevron}>›</span>
            </span>
          </div>
        </div>
      </div>

      {/* ═══ 换算 · Convert ═══ */}
      <div className={styles.group}>
        <div className={styles.groupEyebrow}>换算 · Convert</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.label}>咖啡默认单价</span>
            <span className={styles.value}>
              <span className={styles.prefix}>¥</span>
              <input
                type="number"
                className={styles.input}
                value={config.coffeePrice}
                onChange={(e) => setConfig({ coffeePrice: Number(e.target.value) })}
                min={0}
              />
            </span>
          </div>
        </div>
      </div>

      {/* ═══ 主题 · Theme ═══ */}
      <div className={styles.group}>
        <div className={styles.groupEyebrow}>主题 · Theme</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.label}>配色方案</span>
            <span className={styles.value} style={{ gap: 10 }}>
              {THEME_LIST.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.label}
                  className={`${styles.swatch} ${config.theme === t.id ? styles.swatchActive : ''}`}
                  style={{ background: t.accent }}
                  onClick={() => setTheme(t.id)}
                />
              ))}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ 月度记录 · Salary History ═══ */}
      <div className={styles.group}>
        <div className={styles.groupEyebrow}>月度记录 · Salary History</div>
        <div className={styles.card}>
          {snapshots.length === 0 ? (
            <div className={styles.historyEmpty}>
              暂无月度记录
              <span>到「Month」页点击「已赚」卡片生成</span>
            </div>
          ) : (
            snapshots.map((s) => {
              const parts = s.key.split('-'); const y = Number(parts[0] ?? now.getFullYear()); const mRaw = Number(parts[1] ?? (now.getMonth()+1)); const m = isNaN(mRaw) ? (now.getMonth()+1) : mRaw;
              const isCurrent = s.key === currentMonthKey;
              return (
                <div key={s.key} className={styles.row}>
                  <span className={styles.label}>
                    {y}年 {MONTH_NAMES_CN[(m - 1 + 12) % 12]}
                  </span>
                  <span className={styles.value}>
                    <span className={styles.historyAmount}>
                      ¥{Math.round(s.salary / Math.max(s.workDays, 1) * s.workDays).toLocaleString('en-US')}
                    </span>
                    <span className={styles.historyDays}>· {s.workDays}天</span>
                    {isCurrent ? (
                      <span className={styles.historyBadgeCurrent}>本月</span>
                    ) : (
                      <span className={styles.historyBadgeLocked}>已锁定</span>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══ 保存配置按钮 ═══ */}
      <button type="button" className={styles.saveBtn} onClick={() => {
        const el = document.querySelector('.' + styles.saveBtn);
        if (el) { (el as HTMLElement).textContent = '已保存 ✓'; setTimeout(() => { (el as HTMLElement).textContent = '保存配置'; }, 1200); }
      }}>保存配置</button>

      <div className={styles.footer}>v1.1 · 本地存储</div>
    </>
  );
}

