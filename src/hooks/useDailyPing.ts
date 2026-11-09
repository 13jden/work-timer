/**
 * useDailyPing — App 打开时上报一次日活（v3.2）
 *
 * 组件卸载 / 网络失败都不影响主流程，纯后台动作。
 */
import { useEffect } from 'react';
import { pingDailyActivity } from '../lib/track';

export function useDailyPing(): void {
  useEffect(() => {
    void pingDailyActivity();
  }, []);
}
