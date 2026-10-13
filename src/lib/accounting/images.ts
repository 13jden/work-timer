/**
 * @fileoverview accounting/images — 记录附图引用检查纯函数（v3.0 TASK-056 T-567）
 *
 * 删除 / 换图时找出无其他记录引用的孤儿 imageId，
 * 让调用方去 IndexedDB 把它清掉。
 *
 * 纯函数：无 IO / 无副作用，可独立单测。
 */
import type { AccountRecord } from '../types';

/**
 * 「要换图的记录」的三元组：[记录 id, 旧 imageId, 新 imageId]
 * - 旧 imageId 视为「离开方」（可能被清）
 * - 新 imageId 视为「被引用」（不能被清）
 */
export type ImageChange = readonly [recordId: string, oldImageId: string | undefined, newImageId: string | undefined];

/**
 * 给定「当前全部记录」+「要整条删除的记录 id 列表」+「要换图的记录列表」，
 * 返回应当从 IndexedDB 清理掉的孤儿 imageId 集合。
 *
 * 规则：
 * 1. `removedIds` 中的记录视为整条消失 → 它们的 imageId 算「离开方」
 * 2. `changes` 中的旧 imageId 算「离开方」，新 imageId 算「仍被引用」
 * 3. 任何不在「离开方」或被新 imageId 引用的 imageId 都视为仍被引用
 *
 * @example
 * // 删除 rec-1（imageId='img-1'）+ 把 rec-2 的图从 'img-old' 换成 'img-new'
 * findOrphanedImageIds(
 *   records,
 *   ['rec-1'],
 *   [['rec-2', 'img-old', 'img-new']],
 * )
 * // → ['img-1']（如果 rec-1 的 img-1 没被其他记录引用）
 */
export function findOrphanedImageIds(
  records: readonly AccountRecord[],
  removedIds: readonly string[],
  changes: readonly ImageChange[],
): string[] {
  const removedSet = new Set(removedIds);
  // 哪些记录处于「换图」状态（无论新图是设置 / 清除 / 不变都进入本集合；
  // 旧 imageId 都会被视作「离开」，用 newId 替代原引用关系）
  const changingIds = new Set<string>();
  // 换图记录「新的」imageId（被引用）
  const newReferencedIds = new Set<string>();
  for (const [id, , newId] of changes) {
    changingIds.add(id);
    if (newId) newReferencedIds.add(newId);
  }

  // 收集「离开方」imageId
  const leavingIds = new Set<string>();
  for (const r of records) {
    if (removedSet.has(r.id) && r.imageId) {
      leavingIds.add(r.imageId);
    } else if (changingIds.has(r.id) && r.imageId) {
      leavingIds.add(r.imageId);
    }
  }

  if (leavingIds.size === 0) return [];

  // 收集「仍被引用」imageId：剩余记录的 imageId + change 的新 imageId
  const stillReferenced = new Set<string>();
  for (const r of records) {
    if (removedSet.has(r.id) || changingIds.has(r.id)) continue;
    if (r.imageId) stillReferenced.add(r.imageId);
  }
  for (const newId of newReferencedIds) {
    stillReferenced.add(newId);
  }

  // 离开 - 仍被引用 = 孤儿
  const orphans: string[] = [];
  for (const id of leavingIds) {
    if (!stillReferenced.has(id)) orphans.push(id);
  }
  return orphans;
}
