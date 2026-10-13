import { describe, it, expect } from 'vitest';
import {
  isImageDBSupported,
  putImage,
  getImage,
  hasImage,
  deleteImage,
  _resetImageDBHandleForTests,
} from './imageStore';

describe('imageStore — 无 IndexedDB 环境降级', () => {
  // 测试环境（Node）没有 indexedDB
  it('isImageDBSupported 返回 false', () => {
    expect(isImageDBSupported()).toBe(false);
  });

  it('putImage 返回 false', async () => {
    expect(await putImage('img-test', new Blob(['x']))).toBe(false);
  });

  it('getImage 返回 null', async () => {
    expect(await getImage('img-test')).toBeNull();
  });

  it('hasImage 返回 false', async () => {
    expect(await hasImage('img-test')).toBe(false);
  });

  it('deleteImage 不抛', async () => {
    await expect(deleteImage('img-test')).resolves.toBeUndefined();
  });

  it('_resetImageDBHandleForTests 可调用', () => {
    expect(() => _resetImageDBHandleForTests()).not.toThrow();
  });
});
