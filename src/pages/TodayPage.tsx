/**
 * TodayPage — 今日页
 *
 * v1.3.4-patch5 桌面端布局重构:
 * ┌──────────────────────┬─────────────┐
 * │   TimerCard (主)     │ QuoteCard   │
 * │                      ├─────────────┤
 * │                      │ Worth card  │
 * ├──────────────────────┴─────────────┤
 * │   TimeTrackerWidget(摸鱼,全宽)    │
 * ├───────────────────────────────────┤
 * │   NetHoursDashboard(4 卡,全宽)   │
 * └───────────────────────────────────┘
 *
 * 右栏(DesktopRightPanel):
 * - ConvertPanel(等价换算)
 * - RecordsPanel(时间记录)
 *
 * 移动端沿用原纵向流式布局(各组件全宽堆叠)。
 */
import { useState } from 'react';
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
import { TimeTrackerDetailPage } from './TimeTrackerDetailPage';
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
  const isDesktop = useIsDesktop();

  const earned = todayEarned(now, config, overrides, HOLIDAYS);
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
      <TimeTrackerDetailPage
        onBack={() => setShowSlackingDetail(false)}
      />
    );
  }

  // ── 移动端:纵向堆叠 ──
  if (!isDesktop) {
    return (
      <div className={styles.page}>
        {/* TopBar */}
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
          <TimeTrackerWidget onOpenDetail={() => setShowSlackingDetail(true)} />
        </div>
      </div>
    );
  }

  // ── 桌面端:TopBar(全宽一行)+ Timer+Quote/Worth 同行 + Widget + Dashboard ──
  return (
    <div className={styles.desktopPage}>
      {/* Row 0: TopBar 占据整个桌面端一行 */}
      <div className={styles.topbar}>
        <div className={styles.topbarEyebrowRow}>
          <span className={styles.topbarEyebrow}>today</span>
          <span className={styles.topbarEnglish}>What does it cost</span>
          <span className={styles.topbarRight}>{formatDate(now)}</span>
        </div>
        <div className={styles.topbarCenter}>今日出售时间</div>
      </div>

      {/* Row 1: TimerCard(左) + Quote/Worth 竖排(右,高度匹配 Timer) */}
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

      {/* Row 2: 摸鱼 Widget 全宽(移除详情按钮) */}
      <div className={styles.slackingWrap}>
        <TimeTrackerWidget onOpenDetail={undefined} />
      </div>

      {/* Row 3: 净工时 Dashboard 全宽 */}
      <div className={styles.dashboardWrap}>
        <NetHoursDashboard />
      </div>
    </div>
  );
}