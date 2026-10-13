import { describe, it, expect } from 'vitest';
import type { AccountRecord } from '../types';
import { findOrphanedImageIds } from './images';

const rec = (id: string, imageId?: string): AccountRecord => ({
  id,
  dateKey: '2026-10-13',
  amount: -100,
  type: 'expense',
  categoryId: 'food',
  accountId: 'a1',
  createdAt: 0,
  updatedAt: 0,
  imageId,
});

describe('findOrphanedImageIds', () => {
  it('空记录 + 无操作 → 无孤儿', () => {
    expect(findOrphanedImageIds([], [], [])).toEqual([]);
  });

  it('删除一条无图记录 → 无孤儿', () => {
    const records = [rec('a'), rec('b')];
    expect(findOrphanedImageIds(records, ['a'], [])).toEqual([]);
  });

  it('删除唯一引用 → 孤儿', () => {
    const records = [rec('a', 'img-1'), rec('b')];
    expect(findOrphanedImageIds(records, ['a'], [])).toEqual(['img-1']);
  });

  it('删除一条但还有其他记录引用同图 → 不算孤儿', () => {
    const records = [rec('a', 'img-1'), rec('b', 'img-1')];
    expect(findOrphanedImageIds(records, ['a'], [])).toEqual([]);
  });

  it('换图：旧图只被这条用 → 旧图变孤儿', () => {
    const records = [rec('a', 'img-old')];
    expect(findOrphanedImageIds(records, [], [['a', 'img-old', 'img-new']])).toEqual(['img-old']);
  });

  it('换图：旧图还被别人用 → 不算孤儿', () => {
    const records = [rec('a', 'img-old'), rec('b', 'img-old')];
    expect(findOrphanedImageIds(records, [], [['a', 'img-old', 'img-new']])).toEqual([]);
  });

  it('换图：旧图未引用（这条本就无图） → 无孤儿', () => {
    const records = [rec('a')];
    expect(findOrphanedImageIds(records, [], [['a', undefined, 'img-new']])).toEqual([]);
  });

  it('换图：清除图（newId 为空）→ 旧图变孤儿', () => {
    const records = [rec('a', 'img-old')];
    expect(findOrphanedImageIds(records, [], [['a', 'img-old', undefined]])).toEqual(['img-old']);
  });

  it('混合：删 + 换 同时进行', () => {
    const records = [
      rec('a', 'img-1'), // 删
      rec('b', 'img-2'), // 换为 img-new
      rec('c', 'img-3'), // 保留
    ];
    // img-1 只被 a 引用 → 删后变孤儿
    // img-2 只被 b 引用 → 换成 img-new 后变孤儿
    expect(
      findOrphanedImageIds(records, ['a'], [['b', 'img-2', 'img-new']]),
    ).toEqual(expect.arrayContaining(['img-1', 'img-2']));
    expect(findOrphanedImageIds(records, ['a'], [['b', 'img-2', 'img-new']])).toHaveLength(2);
  });

  it('换图 + 删除同一条记录：旧图去孤儿池', () => {
    // rec-1 既被删除又被换图（不该发生，但保险起见）
    // 此时 rec-1 在 removedSet 中，change 也指向它
    // leavingIds 含 rec-1.imageId; changeMap 不影响（被 removedSet 拦截）
    const records = [rec('a', 'img-1'), rec('b', 'img-1')];
    // 删 a + a 也参与换图（a 已被删，changeMap[a] = img-new 不影响 leavingIds）
    expect(
      findOrphanedImageIds(records, ['a'], [['a', 'img-1', 'img-new']]),
    ).toEqual([]); // b 还引用 img-1
  });
});
