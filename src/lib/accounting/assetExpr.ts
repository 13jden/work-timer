/**
 * @fileoverview assetExpr — 总资产计算器表达式解析（v3.0 TASK-057 T-572）
 *
 * 输入规则（与记账金额同一套）：
 *  - 纯数字 `13000`        → absolute，新总额 = 13000
 *  - 带正负号 `+500` / `-200` → delta，新总额 = 当前 + value
 *  - 链式 `12500+500-200`   → delta，新总额 = 当前 + 解析结果
 *
 * 合法：纯数字 / 首个字符为 `+`/`-` / 中段含 `+`/`-` / 允许千分位逗号 / 允许小数点
 * 非法：空 / 多运算符连写 / 末尾运算符 / 多小数点 / 非数字字符 / 解析结果非有限数 → null
 */
export type AssetExprResult =
  | { mode: 'absolute'; value: number }
  | { mode: 'delta'; value: number };

/**
 * 解析资产输入。非法返回 null。
 */
export function parseAssetExpression(input: string): AssetExprResult | null {
  if (!input) return null;
  // 去千分位逗号 + 去两端空白
  const cleaned = input.replace(/,/g, '').trim();
  if (!cleaned) return null;

  // 字符白名单
  if (!/^[+\-0-9.]+$/.test(cleaned)) return null;

  // 末尾不允许运算符或小数点
  if (/[+\-]$/.test(cleaned)) return null;
  if (/\.$/.test(cleaned)) return null;

  // 多小数点检测（同一数字块内）：拆分每个数字块,任一含 >1 个点 → 非法
  const numberBlocks = cleaned.split(/[+\-]/).filter((b) => b.length > 0);
  for (const b of numberBlocks) {
    if ((b.match(/\./g) || []).length > 1) return null;
  }

  // 解析为 ± 表达式
  const value = evalAssetExpr(cleaned);
  if (!isFinite(value)) return null;

  // 判 mode
  const startsWithOperator = cleaned[0] === '+' || cleaned[0] === '-';
  // 纯数字（无运算符）→ absolute；带运算符 → delta
  if (!startsWithOperator && !/[+\-]/.test(cleaned.slice(1))) {
    return { mode: 'absolute', value };
  }
  return { mode: 'delta', value };
}

/** 从左到右计算 `a±b±c`（支持首字符为 `-`） */
function evalAssetExpr(expr: string): number {
  let e = expr;
  // 末尾运算符/小数点 strip（parseAssetExpression 已守，再做一次保险）
  e = e.replace(/[+\-.]+$/, '');
  if (!e) return NaN;

  // 处理首字符为 - 的情况：当作 0 - ...
  let firstNegative = false;
  if (e[0] === '-') {
    firstNegative = true;
    e = e.slice(1);
  } else if (e[0] === '+') {
    e = e.slice(1);
  }
  if (!e) return NaN;

  const tokens: (number | string)[] = [];
  let buf = '';
  for (const ch of e) {
    if (ch === '+' || ch === '-') {
      if (buf) {
        const n = parseFloat(buf);
        if (!isFinite(n)) return NaN;
        tokens.push(n);
      }
      tokens.push(ch);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) {
    const n = parseFloat(buf);
    if (!isFinite(n)) return NaN;
    tokens.push(n);
  }
  if (tokens.length === 0) return NaN;

  // 计算
  let acc = firstNegative ? -(tokens[0] as number) : (tokens[0] as number);
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i] as string;
    const n = tokens[i + 1] as number;
    if (n === undefined) break;
    acc = op === '+' ? acc + n : acc - n;
  }
  return acc;
}

/**
 * 预览：给定当前总额 + 表达式结果，返回新总额。
 * delta: 当前 + value；absolute: value。
 */
export function previewAsset(
  current: number,
  parsed: AssetExprResult,
): number {
  return parsed.mode === 'absolute' ? parsed.value : current + parsed.value;
}
