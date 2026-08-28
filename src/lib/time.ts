/**
 * Salary Timer — Time Utilities
 * 纯函数,无副作用。所有格式化日期 / 时间逻辑集中此处。
 */

/**
 * 解析 "HH:MM" 字符串为 { h, m }
 */
export function parseTime(str: string): { h: number; m: number } {
  const parts = str.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  return { h, m };
}

/**
 * "HH:MM" → 总分钟数。例如 "09:30" → 570
 */
export function toMinutes(str: string): number {
  const { h, m } = parseTime(str);
  return h * 60 + m;
}

/**
 * 当前时刻的总分钟数(含秒小数)。例 14:30:45 → 870.75
 */
export function nowInMinutes(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

/**
 * 数字补零到 2 位
 */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Date → "YYYY-MM-DD"
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 毫秒 → "HH:MM:SS"
 */
export function formatHMS(ms: number, status: string, label: string): {
  display: string;
  label: string;
  status: string;
} {
  const total = Math.max(Math.floor(ms / 1000), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return {
    display: `${pad2(h)}:${pad2(m)}:${pad2(s)}`,
    label,
    status,
  };
}