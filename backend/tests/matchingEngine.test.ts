import { describe, it, expect } from 'vitest';
import { computeMatchScore } from '../src/matching/matchingEngine.js';
import { ExtractedCv, NormalizedJob } from '../src/types/index.js';

function baseJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    title: 'Frontend Developer',
    employer: 'Tech PLC',
    description: 'React, TypeScript frontend role',
    descriptionPlain: 'React, TypeScript frontend role, 2+ years experience',
    skills: ['React', 'TypeScript', 'CSS'],
    sector: 'ICT & Software',
    region: 'Addis Ababa',
    city: 'Addis Ababa',
    locationRaw: 'Addis Ababa',
    employmentType: 'FULL_TIME',
    educationLevel: 'BACHELOR',
    currency: 'ETB',
    originalUrl: 'https://example.com/job/1',
    sourceAttribution: 'Test',
    sourceId: 'test',
    verificationStatus: 'VERIFIED',
    expirationStatus: 'ACTIVE',
    ...overrides,
  };
}

const baseCv: ExtractedCv = {
  fullName: 'Abebe Bikila',
  location: 'Addis Ababa',
  education: [{ institution: 'Addis Ababa University', degree: 'BSc Software Engineering', level: 'BACHELOR' }],
  experience: [
    { employer: 'Dev Shop', title: 'Junior Frontend Developer', description: 'Built React apps' },
    { employer: 'Startup', title: 'React Developer', description: 'TypeScript, Tailwind' },
  ],
  skills: [{ name: 'React' }, { name: 'TypeScript' }, { name: 'JavaScript' }, { name: 'CSS' }],
};

describe('matching engine', () => {
  it('decomposes the score into weighted dimensions summing to at most 100', () => {
    const res = computeMatchScore(baseCv, baseJob());
    expect(res.overallScore).toBeLessThanOrEqual(100);
    expect(res.overallScore).toBeGreaterThan(60);
    const sum = res.dimensions.reduce((a, b) => a + b.score, 0);
    expect(res.overallScore).toBe(Math.min(100, sum));
    expect(res.dimensions.map((d) => d.name)).toEqual([
      'Education',
      'Required Skills',
      'Preferred Skills',
      'Experience',
      'Qualifications',
      'Location',
      'Languages',
      'Fit & Sector',
    ]);
  });

  it('reports missing required skills and disqualifiers honestly', () => {
    const res = computeMatchScore(baseCv, baseJob({ skills: ['Kubernetes', 'Go', 'Rust'] }));
    expect(res.missingRequirements.length).toBe(3);
    expect(res.disqualifiers).toContain('Few required skills matched');
  });

  it('never claims eligibility when information is missing — flags unknown requirements', () => {
    const res = computeMatchScore(baseCv, baseJob({ educationLevel: 'NOT_SPECIFIED', skills: [] }));
    expect(res.unknownRequirements).toContain('Education requirement not specified by employer');
    expect(res.unknownRequirements).toContain('Required skills not explicitly listed by employer');
  });

  it('penalizes education mismatch and flags potential disqualifier', () => {
    const res = computeMatchScore(baseCv, baseJob({ educationLevel: 'MASTER' }));
    expect(res.partialRequirements.some((p) => p.includes('below listed requirement'))).toBe(true);
    expect(res.disqualifiers.some((d) => d.includes('Education'))).toBe(true);
  });

  it('includes the mandatory non-probability disclaimer', () => {
    const res = computeMatchScore(baseCv, baseJob());
    expect(res.disclaimer).toMatch(/NOT a probability of employment/i);
  });
});
