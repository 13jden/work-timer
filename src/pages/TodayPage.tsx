/**
 * TodayPage — 原有今日计时页
 *
 * 移动端按原顺序展示：计时卡 → 每日引言 → 收入/等价物 → 时间记录。
 * 桌面端使用左侧计时卡、右侧引言与等价物、底部时间记录与净工时的布局。
 */
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { HOLIDAYS } from '../lib/constants';
import { effectiveHourlyRate, perSecond, todayEarned } from '../lib/compute';
import { useNow } from '../hooks/useNow';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { TimerCard } from '../components/TimerCard';
import { StatCard } from '../components/StatCard';
import { QuoteCard } from '../components/QuoteCard';
import { TimeTrackerWidget } from '../components/TimeTrackerWidget';
import { NetHoursDashboard } from '../components/NetHoursDashboard/NetHoursDashboard';
import styles from './TodayPage.module.css';

interface TodayPageProps {
  /** 点击“查看更多”时打开等价换算 */
  onOpenConvert?: () => void;
  /** 打开时间记录页 */
  onOpenFish?: () => void;
}

function formatDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

export function TodayPage({ onOpenConvert, onOpenFish }: TodayPageProps) {
  const now = useNow(1000);
  const config = useConfigStore();
  const overrides = useCalendarStore((state) => state.dayOverrides);
  const isDesktop = useIsDesktop();

  const earned = todayEarned(now, config, overrides, HOLIDAYS);
  const hourly = effectiveHourlyRate(now, config, overrides, HOLIDAYS);
  const perSec = perSecond(now.getFullYear(), now.getMonth(), config, overrides, HOLIDAYS);
  const coffeeCount = config.coffeePrice > 0 ? earned / config.coffeePrice : 0;

  const year = now.getFullYear();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(year, 0, 0).getTime()) / 86_400_000,
  );

  // 移动端保持原版纵向流式布局。
  if (!isDesktop) {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <div className={styles.topbarEyebrowRow}>
            <span className={styles.topbarEyebrow}>today</span>
            <span className={styles.topbarEnglish}>What does it cost</span>
            <span className={styles.topbarRight}>{formatDate(now)}</span>
          </div>
          <div className={styles.topbarCenter}>今日出售时间</div>
        </div>

        <div className={styles.timerWrap}>
          <TimerCard />
        </div>

        <div className={styles.quoteWrap}>
          <QuoteCard index={dayOfYear} />
        </div>

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

        <div className={styles.slackingWrap}>
          <TimeTrackerWidget onOpenDetail={onOpenFish} />
        </div>
      </div>
    );
  }

  // 桌面端保持原版两栏结构，时间记录与净工时横跨主内容区。
  return (
    <div className={styles.desktopPage}>
      <div className={styles.topbar}>
        <div className={styles.topbarEyebrowRow}>
          <span className={styles.topbarEyebrow}>today</span>
          <span className={styles.topbarEnglish}>What does it cost</span>
          <span className={styles.topbarRight}>{formatDate(now)}</span>
        </div>
        <div className={styles.topbarCenter}>今日出售时间</div>
      </div>

      <div className={styles.topRow}>
        <div className={styles.timerWrap}>
          <TimerCard />
        </div>
        <div className={styles.sideCol}>
          <div className={styles.quoteWrap}>
            <QuoteCard index={dayOfYear} />
          </div>
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

      <div className={styles.slackingWrap}>
        <TimeTrackerWidget onOpenDetail={undefined} />
      </div>

      <div className={styles.dashboardWrap}>
        <NetHoursDashboard />
      </div>
    </div>
  );
}
