/**
 * @fileoverview JourneySection — MINE 页「一程」入口卡（v3.0 TASK-059 T-596 · v3.1 TASK-063 文案 · v3.1 TASK-064 竖版）
 *
 * 竖版紧凑入口卡（与「定期账」卡并排），整卡点击触发 onOpen，
 * 由 MinePage 切到独立全屏的 JourneyListPage。
 *
 * 视觉骨架来自共享组件 EntryCard（登机牌 / 护照页风）：
 * 邮戳圆 + 斜纹底纹 + 虚线边框。
 */
import { useMemo } from 'react';
import { useAccountStore } from '../../../store/accountStore';
import { journeyTotals } from '../../../lib/accounting/journey';
import { AirplaneTilt } from '@phosphor-icons/react';
import { EntryCard } from '../EntryCard/EntryCard';

interface JourneySectionProps {
  onOpen: () => void;
}

export function JourneySection({ onOpen }: JourneySectionProps) {
  const journeys = useAccountStore((s) => s.journeys);
  const records = useAccountStore((s) => s.records);

  const summaries = useMemo(() => journeyTotals(journeys, records), [journeys, records]);

  const recent = useMemo(
    () =>
      [...journeys]
        .sort((a, b) => {
          const sA = summaries.get(a.id);
          const sB = summaries.get(b.id);
          const keyA = sA?.lastKey ?? String(a.updatedAt);
          const keyB = sB?.lastKey ?? String(b.updatedAt);
          return keyB.localeCompare(keyA);
        })[0],
    [journeys, summaries],
  );

  const totalCount = journeys.length;
  const meta =
    totalCount === 0
      ? '还没有启程'
      : recent
        ? `最近 · ${recent.title}`
        : '一程';

  return (
    <EntryCard
      overline="ONE WAY"
      stamp
      icon={<AirplaneTilt size={15} weight="fill" />}
      value={String(totalCount)}
      unit="程"
      meta={meta}
      foot="查看全部"
      onOpen={onOpen}
      ariaLabel="打开一程"
    />
  );
}
