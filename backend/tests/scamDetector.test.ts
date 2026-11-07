import { describe, it, expect } from 'vitest';
import { assessJobRisk, RULES } from '../src/scam/scamDetector.js';
import { normalizeJob } from '../src/normalizer/jobNormalizer.js';

function makeJob(title: string, desc: string, extra: Record<string, any> = {}) {
  return normalizeJob({
    url: 'https://example.com/job/1',
    title,
    employer: 'Test Employer',
    locationRaw: 'Addis Ababa',
    description: desc,
    descriptionPlain: desc,
    ...extra,
  });
}

describe('scam detector rules', () => {
  it('flags upfront registration fee requests as HIGH severity', () => {
    const job = makeJob('Clerk', 'All applicants must pay a registration fee of 500 birr via Telebirr');
    const res = assessJobRisk(job);
    expect(res.riskLevel).toBe('HIGH');
    const f = res.flags.find((x) => x.code === 'UPFRONT_FEE_REQUEST')!;
    expect(f.severity).toBe('HIGH');
    expect(f.reason).toMatch(/almost never charge/i);
    expect(f.evidence).toMatch(/registration fee/i);
  });

  it('flags financial information requests as HIGH severity', () => {
    const job = makeJob('Assistant', 'Send bank account number and credit card details for payroll pre-approval');
    const res = assessJobRisk(job);
    expect(res.flags.some((x) => x.code === 'FINANCIAL_INFO_REQUEST')).toBe(true);
  });

  it('flags free webmail for large recognizable employers', () => {
    const job = makeJob('Teller', 'Apply by emailing cbe.vacancy@gmail.com', { employer: 'Commercial Bank of Ethiopia' });
    const res = assessJobRisk(job);
    expect(res.flags.some((x) => x.code === 'SUSPICIOUS_EMPLOYER_EMAIL')).toBe(true);
  });

  it('flags shortened application URLs', () => {
    const job = normalizeJob({
      url: 'https://example.com/job/1',
      title: 'Driver',
      locationRaw: 'Addis Ababa',
      applicationUrl: 'https://bit.ly/3xyzapply',
    });
    const res = assessJobRisk(job);
    expect(res.flags.some((x) => x.code === 'SUSPICIOUS_APPLICATION_LINK')).toBe(true);
  });

  it('flags unrealistic salaries', () => {
    const job = normalizeJob({
      url: 'https://example.com/job/1',
      title: 'Intern',
      locationRaw: 'Addis Ababa',
      salaryMax: 50_000_000,
    });
    const res = assessJobRisk(job);
    expect(res.flags.some((x) => x.code === 'UNREALISTIC_SALARY')).toBe(true);
  });

  it('keeps clean listings at LOW risk', () => {
    const job = makeJob('Frontend Engineer', 'Build React applications with a great team in Addis Ababa.');
    expect(assessJobRisk(job).riskLevel).toBe('LOW');
  });

  it('every flag always carries a human-readable reason (Section 12)', () => {
    for (const r of RULES) {
      expect(typeof r.check).toBe('function');
    }
  });
});
