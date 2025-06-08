import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateConsecutiveNumber, generateInvoiceKey } from '../src/services/sequenceService.ts';

vi.mock('../src/services/supabaseCompanyService.ts', () => ({
  supabaseCompanyService: {
    getCompanySecurityCode: vi.fn().mockResolvedValue('12345678')
  }
}));

function mockLocalStorage() {
  const store: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) delete store[k];
      }
    },
    configurable: true
  });
}

describe('sequenceService', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('generateConsecutiveNumber returns 20 digits', () => {
    const num = generateConsecutiveNumber('company1');
    expect(num).toHaveLength(20);
  });

  it('generateInvoiceKey returns 50 digits starting with 506', async () => {
    const key = await generateInvoiceKey('company1', '123456789');
    expect(key).toHaveLength(50);
    expect(key.startsWith('506')).toBe(true);
  });
});

