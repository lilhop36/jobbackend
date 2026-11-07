import { describe, it, expect } from 'vitest';
import { normalizeEmployer, titleSimilarity } from '../src/deduplicator/deduplicator.js';

describe('employer name normalization', () => {
  it('strips common corporate suffixes and punctuation', () => {
    expect(normalizeEmployer('Ethio Telecom S.C.')).toBe('ethio telecom');
    expect(normalizeEmployer('Commercial Bank of Ethiopia Share Company')).toBe('commercial bank of');
    expect(normalizeEmployer('Awash Bank PLC')).toBe('awash bank');
    expect(normalizeEmployer('UNICEF Ethiopia Country Office')).toBe('unicef country office');
  });
});

describe('title similarity', () => {
  it('scores near 1 for identical token sets', () => {
    expect(titleSimilarity('Senior Frontend Developer', 'Frontend Developer Senior')).toBe(1);
  });

  it('scores above 0.72 fuzzy threshold for minor rewordings', () => {
    expect(titleSimilarity('Software Engineer (Backend)', 'Backend Software Engineer')).toBeGreaterThanOrEqual(0.72);
  });

  it('scores low for genuinely different jobs', () => {
    expect(titleSimilarity('Frontend Developer', 'Registered Nurse')).toBe(0);
    expect(titleSimilarity('Accountant', 'Logistics Officer')).toBe(0);
  });
});
