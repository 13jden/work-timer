/**
 * TodayPage — 今日页(Timer + Stats)
 * 用户打开 App 第一眼看到的内容。
 */
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { HOLIDAYS } from '../lib/constants';
import { hourlyRate, perSecond, todayEarned } from '../lib/compute';
import { useNow } from '../hooks/useNow';
import { StatusBar } from '../components/StatusBar';
import { TimerCard } from '../components/TimerCard';
import { StatCard } from '../components/StatCard';
import { QuoteCard } from '../components/QuoteCard';
import styles from './TodayPage.module.css';

interface TodayPageProps {
  /** 点击"查看更多"时跳转(由 App 路由层注入) */
  onOpenConvert?: () => void;
}

export function TodayPage({ onOpenConvert }: TodayPageProps) {
  const now = useNow(1000);
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);

  const earned = todayEarned(now, config, overrides, HOLIDAYS);
  const hourly = hourlyRate(now.getFullYear(), now.getMonth(), config, overrides, HOLIDAYS);
  const perSec = perSecond(now.getFullYear(), now.getMonth(), config, overrides, HOLIDAYS);
  const coffeeCount = config.coffeePrice > 0 ? earned / config.coffeePrice : 0;

  const year = now.getFullYear();
  const dayOfYear = (() => {
    const start = new Date(year, 0, 0);
    const diff = now.getTime() - start.getTime();
    return Math.floor(diff / 86_400_000);
  })();

  return (
    <>
      <StatusBar />
      <div className={styles.hero}>
        <div className={styles.heroColLeft}>
          <TimerCard />
          <div className={styles.mobileQuote}>
            <QuoteCard index={dayOfYear} />
          </div>
        </div>
        <div className={styles.heroColRight}>
          <div className={styles.statsRow}>
            <StatCard
              index="01 / INCOME"
              value={`¥${earned.toFixed(2)}`}
              variant="income"
              sub={`¥${hourly.toFixed(2)} / 小时`}
              extra={`¥${perSec.toFixed(4)} / 秒`}
            />
            <StatCard
              index="02 / WORTH"
              value={`${Math.floor(coffeeCount)} 杯`}
              variant="equivalent"
              flavor
              sub={`按 ¥${config.coffeePrice} 算`}
              extra={onOpenConvert ? <span onClick={onOpenConvert}>查看更多 →</span> : undefined}
              onClick={onOpenConvert}
            />
          </div>
        </div>
      </div>
      <div className={styles.desktopQuote}>
        <QuoteCard index={dayOfYear} />
      </div>
    </>
  );
}