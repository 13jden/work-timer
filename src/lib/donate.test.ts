/**
 * Salary Timer — 打赏金额校验单测（v3.2）
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  validateDonation,
  formatAmount,
  DONATE_MAX_AMOUNT,
  DONATE_MAX_NOTE_LEN,
  fetchDonatePayUrls,
  isWechatBrowser,
  EMPTY_PAY_URLS,
} from './donate';
import { request } from './api';

vi.mock('./api', () => ({
  request: vi.fn(),
}));

const mockedRequest = vi.mocked(request);

describe('donate', () => {
  describe('validateDonation', () => {
    it('accepts a plain integer amount', () => {
      const res = validateDonation('12');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.amount).toBe(12);
        expect(res.amountText).toBe('12');
      }
    });

    it('accepts one or two decimal places', () => {
      const r1 = validateDonation('12.5');
      expect(r1.ok).toBe(true);
      if (r1.ok) expect(r1.amount).toBe(12.5);

      const r2 = validateDonation('12.50');
      expect(r2.ok).toBe(true);
      if (r2.ok) expect(r2.amount).toBe(12.5);
    });

    it('accepts a currency symbol prefix', () => {
      const res = validateDonation('¥8.8');
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.amount).toBe(8.8);
    });

    it('rejects an empty amount', () => {
      const res = validateDonation('   ');
      expect(res.ok).toBe(false);
    });

    it('rejects zero', () => {
      expect(validateDonation('0').ok).toBe(false);
    });

    it('rejects a negative amount', () => {
      expect(validateDonation('-5').ok).toBe(false);
    });

    it('rejects non-numeric input', () => {
      expect(validateDonation('abc').ok).toBe(false);
      expect(validateDonation('1.2.3').ok).toBe(false);
    });

    it('rejects more than two decimal places', () => {
      expect(validateDonation('1.234').ok).toBe(false);
    });

    it('rejects an amount over the cap', () => {
      expect(validateDonation(String(DONATE_MAX_AMOUNT + 1)).ok).toBe(false);
    });

    it('accepts an amount exactly at the cap', () => {
      expect(validateDonation(String(DONATE_MAX_AMOUNT)).ok).toBe(true);
    });

    it('truncates an overlong note instead of failing', () => {
      const res = validateDonation('10', 'n'.repeat(DONATE_MAX_NOTE_LEN + 30));
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.note).toHaveLength(DONATE_MAX_NOTE_LEN);
    });

    it('defaults the note to empty', () => {
      const res = validateDonation('10');
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.note).toBe('');
    });
  });

  describe('formatAmount', () => {
    it('drops trailing zeros', () => {
      expect(formatAmount(12)).toBe('12');
      expect(formatAmount(12.5)).toBe('12.5');
      expect(formatAmount(12.50)).toBe('12.5');
    });

    it('keeps a zero amount as "0"', () => {
      expect(formatAmount(0)).toBe('0');
    });

    it('cleans up binary floating point artifacts', () => {
      // 0.1 + 0.2 在 IEEE754 下是 0.30000000000000004
      expect(formatAmount(0.1 + 0.2)).toBe('0.3');
    });
  });

  describe('fetchDonatePayUrls', () => {
    afterEach(() => {
      mockedRequest.mockReset();
    });

    it('reads the alipay url from the config endpoint', async () => {
      mockedRequest.mockResolvedValue({
        ok: true,
        status: 200,
        data: {
          ok: true,
          config: {
            alipayPayUrl: 'https://qr.alipay.com/fkx123',
          },
        },
        error: null,
      });

      const urls = await fetchDonatePayUrls();
      expect(urls.alipayUrl).toBe('https://qr.alipay.com/fkx123');
    });

    it('trims whitespace around the urls', async () => {
      mockedRequest.mockResolvedValue({
        ok: true,
        status: 200,
        data: {
          ok: true,
          config: { alipayPayUrl: '  https://qr.alipay.com/fkx123  ' },
        },
        error: null,
      });

      const urls = await fetchDonatePayUrls();
      expect(urls.alipayUrl).toBe('https://qr.alipay.com/fkx123');
    });

    it('falls back to empty urls when the response has no config', async () => {
      mockedRequest.mockResolvedValue({
        ok: true,
        status: 200,
        data: { ok: true },
        error: null,
      });

      expect(await fetchDonatePayUrls()).toEqual(EMPTY_PAY_URLS);
    });

    it('falls back to empty urls on a failed request', async () => {
      mockedRequest.mockResolvedValue({
        ok: false,
        status: 500,
        data: null,
        error: 'HTTP 500',
      });

      expect(await fetchDonatePayUrls()).toEqual(EMPTY_PAY_URLS);
    });

    it('never throws when the request rejects', async () => {
      mockedRequest.mockRejectedValue(new Error('network down'));

      await expect(fetchDonatePayUrls()).resolves.toEqual(EMPTY_PAY_URLS);
    });
  });

  describe('isWechatBrowser', () => {
    const originalUA = navigator.userAgent;

    afterEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    });

    it('detects the WeChat in-app browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone) MicroMessenger/8.0.30',
        configurable: true,
      });
      expect(isWechatBrowser()).toBe(true);
    });

    it('returns false in a normal browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
        configurable: true,
      });
      expect(isWechatBrowser()).toBe(false);
    });
  });
});
