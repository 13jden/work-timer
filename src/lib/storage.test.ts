/**
 * Salary Timer — Storage Layer Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadJSON, saveJSON, removeJSON } from './storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadJSON', () => {
    it('returns fallback when key not exists', () => {
      expect(loadJSON('missing', { a: 1 })).toEqual({ a: 1 });
    });

    it('returns fallback when localStorage has no key', () => {
      const fallback = ['default'];
      expect(loadJSON('absent', fallback)).toEqual(fallback);
    });

    it('parses valid JSON', () => {
      localStorage.setItem('test', JSON.stringify({ x: 42 }));
      expect(loadJSON<{ x: number }>('test', { x: 0 })).toEqual({ x: 42 });
    });

    it('returns fallback when value is invalid JSON', () => {
      localStorage.setItem('bad', '{not json}');
      const fallback = { ok: true };
      expect(loadJSON('bad', fallback)).toBe(fallback);
    });
  });

  describe('saveJSON', () => {
    it('writes and reads back', () => {
      const data = { items: [1, 2, 3] };
      saveJSON('key', data);
      expect(JSON.parse(localStorage.getItem('key')!)).toEqual(data);
    });

    it('does not throw on circular structures (silently fails)', () => {
      const obj: Record<string, unknown> = { name: 'x' };
      obj.self = obj; // 循环引用
      expect(() => saveJSON('circular', obj)).not.toThrow();
    });
  });

  describe('removeJSON', () => {
    it('removes key', () => {
      localStorage.setItem('temp', '"hello"');
      removeJSON('temp');
      expect(localStorage.getItem('temp')).toBeNull();
    });

    it('does not throw on missing key', () => {
      expect(() => removeJSON('nope')).not.toThrow();
    });
  });
});