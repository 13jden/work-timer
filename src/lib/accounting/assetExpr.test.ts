import { describe, it, expect } from 'vitest';
import { parseAssetExpression, previewAsset } from './assetExpr';

describe('parseAssetExpression（v3.0 TASK-057 T-572）', () => {
  describe('absolute 模式（纯数字）', () => {
    it('整数', () => {
      expect(parseAssetExpression('13000')).toEqual({ mode: 'absolute', value: 13000 });
    });
    it('带千分位', () => {
      expect(parseAssetExpression('1,200,500')).toEqual({ mode: 'absolute', value: 1200500 });
    });
    it('小数', () => {
      expect(parseAssetExpression('12500.50')).toEqual({ mode: 'absolute', value: 12500.5 });
    });
    it('0', () => {
      expect(parseAssetExpression('0')).toEqual({ mode: 'absolute', value: 0 });
    });
  });

  describe('delta 模式（带正负号）', () => {
    it('+500', () => {
      expect(parseAssetExpression('+500')).toEqual({ mode: 'delta', value: 500 });
    });
    it('-200', () => {
      expect(parseAssetExpression('-200')).toEqual({ mode: 'delta', value: -200 });
    });
    it('12500+500-200 → 链式', () => {
      expect(parseAssetExpression('12500+500-200')).toEqual({ mode: 'delta', value: 12800 });
    });
    it('+1,200.5', () => {
      expect(parseAssetExpression('+1,200.5')).toEqual({ mode: 'delta', value: 1200.5 });
    });
    it('小数链 10.5+0.3', () => {
      expect(parseAssetExpression('10.5+0.3')).toEqual({ mode: 'delta', value: 10.8 });
    });
  });

  describe('非法输入 → null', () => {
    it('空串', () => expect(parseAssetExpression('')).toBeNull());
    it('只有空格', () => expect(parseAssetExpression('   ')).toBeNull());
    it('末尾运算符 +', () => expect(parseAssetExpression('100+')).toBeNull());
    it('末尾运算符 -', () => expect(parseAssetExpression('100-')).toBeNull());
    it('末尾小数点', () => expect(parseAssetExpression('100.')).toBeNull());
    it('多小数点', () => expect(parseAssetExpression('1.2.3')).toBeNull());
    it('字母', () => expect(parseAssetExpression('100a')).toBeNull());
    it('空格夹杂', () => expect(parseAssetExpression('100 + 200')).toBeNull());
    it('两运算符连写 ++', () => expect(parseAssetExpression('100++200')).toBeNull());
  });
});

describe('previewAsset', () => {
  it('absolute 直接覆盖', () => {
    expect(previewAsset(1000, { mode: 'absolute', value: 500 })).toBe(500);
  });
  it('delta 累加', () => {
    expect(previewAsset(1000, { mode: 'delta', value: 500 })).toBe(1500);
  });
  it('delta 负数', () => {
    expect(previewAsset(1000, { mode: 'delta', value: -300 })).toBe(700);
  });
  it('delta 链式', () => {
    // 1000 + (12500+500-200) = 1000 + 12800 = 13800
    const parsed = parseAssetExpression('12500+500-200')!;
    expect(previewAsset(1000, parsed)).toBe(13800);
  });
});
