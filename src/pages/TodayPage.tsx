/**
 * TodayPage — 今日页(Timer + Stats + 摸鱼 Widget)
 *
 * v1.3 扩展:
 *   - SlackingWidget 摸鱼卡片
 *   - 详情页路由(通过 showSlackingDetail state)
 */
import { useState } from 'react';
import { useConfigStore } from '../store/configStore';
import { useCalendarStore } from '../store/calendarStore';
import { HOLIDAYS } from '../lib/constants';
import { effectiveHourlyRate, perSecond, todayEarned } from '../lib/compute';
import { useNow } from '../hooks/useNow';
import { TimerCard } from '../components/TimerCard';
import { StatCard } from '../components/StatCard';
import { QuoteCard } from '../components/QuoteCard';
import { SlackingWidget } from '../components/SlackingWidget';
import { SlackingDetailPage } from './SlackingDetailPage';
import styles from './TodayPage.module.css';

interface TodayPageProps {
  /** 点击"查看更多"时跳转(由 App 路由层注入) */
  onOpenConvert?: () => void;
}

function formatDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

export function TodayPage({ onOpenConvert }: TodayPageProps) {
  const [showSlackingDetail, setShowSlackingDetail] = useState(false);

  const now = useNow(1000);
  const config = useConfigStore();
  const overrides = useCalendarStore((s) => s.dayOverrides);

  const earned = todayEarned(now, config, overrides, HOLIDAYS);
  // v1.3.2 Bug Fix:时薪按当前正在的工作计算
  // 优先级:override.segments(今天如果有兼职/自定义工时) > config.segmentTemplates > config.startTime/endTime
  // effectiveHourlyRate 内部走 effectiveDailyRate,已内置 freelance override(优先级:freelanceHourly > freelanceDaily > config.manualDailyRate)
  const hourly = effectiveHourlyRate(now, config, overrides, HOLIDAYS);
  const perSec = perSecond(now.getFullYear(), now.getMonth(), config, overrides, HOLIDAYS);
  const coffeeCount = config.coffeePrice > 0 ? earned / config.coffeePrice : 0;

  const year = now.getFullYear();
  const dayOfYear = (() => {
    const start = new Date(year, 0, 0);
    const diff = now.getTime() - start.getTime();
    return Math.floor(diff / 86_400_000);
  })();

  // ── 详情页路由 ──
  if (showSlackingDetail) {
    return (
      <SlackingDetailPage
        onBack={() => setShowSlackingDetail(false)}
      />
    );
  }

  return (
    <div className={styles.page}>
      {/* ============ TopBar — 两行结构 ============ */}
      <div className={styles.topbar}>
        <div className={styles.topbarEyebrowRow}>
          <span className={styles.topbarEyebrow}>today</span>
          <span className={styles.topbarEnglish}>What does it cost</span>
          <span className={styles.topbarRight}>{formatDate(now)}</span>
        </div>
        <div className={styles.topbarCenter}>今日出售时间</div>
      </div>

      {/* ============ TimerCard ============ */}
      <div className={styles.timerWrap}>
        <TimerCard />
      </div>

      {/* ============ QuoteCard (在 Timer 和 Stats 之间) ============ */}
      <div className={styles.quoteWrap}>
        <QuoteCard index={dayOfYear} />
      </div>

      {/* ============ Stats Row (两卡片并排) ============ */}
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

      {/* ============ SlackingWidget(v1.3.1 移到最下面) ============ */}
      <div className={styles.slackingWrap}>
        <SlackingWidget onOpenDetail={() => setShowSlackingDetail(true)} />
      </div>
    </div>
  );
}
