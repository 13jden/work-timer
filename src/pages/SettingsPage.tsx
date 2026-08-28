/**
 * SettingsPage — 设置页
 *
 * 包含:
 * - 薪资配置(月薪、上班、下班、咖啡价)
 * - 休息模式
 * - 主题切换
 *
 * 所有改动实时写入 configStore(Zustand persist 自动持久化)。
 */
import { useMemo } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { useThemeStore, THEME_LIST } from '../store/themeStore';
import { HOLIDAYS } from '../lib/constants';
import { workdaysInMonth } from '../lib/compute';
import { useNow } from '../hooks/useNow';
import { StatusBar } from '../components/StatusBar';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  const config = useConfigStore();
  const setConfig = useConfigStore((s) => s.setConfig);
  const overrides = useCalendarStore((s) => s.dayOverrides);
  const setTheme = useThemeStore((s) => s.setTheme);
  const now = useNow(60_000);

  const workdays = useMemo(
    () => workdaysInMonth(now.getFullYear(), now.getMonth(), config, overrides, HOLIDAYS),
    [now, config, overrides],
  );

  return (
    <>
      <StatusBar />

      {/* 薪资 */}
      <div className={styles.group}>
        <div className={styles.eyebrow}>薪资 · Salary</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.label}>月薪</span>
            <span className={styles.prefix}>¥</span>
            <input
              type="number"
              className={styles.input}
              value={config.monthlySalary}
              onChange={(e) => setConfig({ monthlySalary: Number(e.target.value) })}
              min={0}
            />
          </div>
          <div className={styles.row}>
            <span className={styles.label}>上班</span>
            <input
              type="time"
              className={styles.input}
              value={config.startTime}
              onChange={(e) => setConfig({ startTime: e.target.value })}
              style={{ width: 90, textAlign: 'right' }}
            />
          </div>
          <div className={styles.row}>
            <span className={styles.label}>下班</span>
            <input
              type="time"
              className={styles.input}
              value={config.endTime}
              onChange={(e) => setConfig({ endTime: e.target.value })}
              style={{ width: 90, textAlign: 'right' }}
            />
          </div>
          <div className={styles.row}>
            <span className={styles.label}>咖啡价</span>
            <span className={styles.prefix}>¥</span>
            <input
              type="number"
              className={styles.input}
              value={config.coffeePrice}
              onChange={(e) => setConfig({ coffeePrice: Number(e.target.value) })}
              min={0}
            />
          </div>
          <div className={styles.row}>
            <span className={styles.label}>当月工作日</span>
            <span className={styles.prefix} style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              {workdays} 天
            </span>
          </div>
        </div>
      </div>

      {/* 休息模式 */}
      <div className={styles.group}>
        <div className={styles.eyebrow}>休息 · Rest</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.label}>每周休息</span>
            <select
              className={styles.select}
              value={config.restMode}
              onChange={(e) => setConfig({ restMode: Number(e.target.value) as 0 | 1 | 2 })}
            >
              <option value={0}>无休</option>
              <option value={1}>单休</option>
              <option value={2}>双休</option>
            </select>
          </div>
        </div>
      </div>

      {/* 主题 */}
      <div className={styles.group}>
        <div className={styles.eyebrow}>主题 · Theme</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.label}>配色</span>
            <div className={styles.swatchRow}>
              {THEME_LIST.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.label}
                  className={`${styles.swatch} ${config.theme === t.id ? styles.swatchActive : ''}`}
                  style={{ background: t.paper }}
                  onClick={() => setTheme(t.id)}
                />
              ))}
              <span className={styles.swatchLabel}>
                {THEME_LIST.find((t) => t.id === config.theme)?.label ?? ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>Salary Timer · {new Date().getFullYear()}</div>
    </>
  );
}
