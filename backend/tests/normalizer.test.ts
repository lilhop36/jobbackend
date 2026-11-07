import { describe, it, expect } from 'vitest';
import { resolveLocation, ETHIOPIAN_REGIONS } from '../src/normalizer/ethiopianLocations.js';
import { normalizeJob, inferSector, inferEducationLevel, inferEmploymentType } from '../src/normalizer/jobNormalizer.js';

describe('Ethiopian locations taxonomy', () => {
  it('defines 14 regions per spec Section 8', () => {
    expect(ETHIOPIAN_REGIONS.length).toBe(14);
    expect(ETHIOPIAN_REGIONS).toContain('Addis Ababa');
    expect(ETHIOPIAN_REGIONS).toContain('Oromia');
    expect(ETHIOPIAN_REGIONS).toContain('Sidama');
    expect(ETHIOPIAN_REGIONS).toContain('Dire Dawa');
  });

  it('maps major cities to their regions', () => {
    expect(resolveLocation('Adama, Ethiopia')).toEqual({ region: 'Oromia', city: 'Adama' });
    expect(resolveLocation('Hawassa')).toEqual({ region: 'Sidama', city: 'Hawassa' });
    expect(resolveLocation('Bahir Dar, Amhara')).toEqual({ region: 'Amhara', city: 'Bahir Dar' });
    expect(resolveLocation('Mekelle, Tigray')).toEqual({ region: 'Tigray', city: 'Mekelle' });
    expect(resolveLocation('Jimma')).toEqual({ region: 'Oromia', city: 'Jimma' });
    expect(resolveLocation('Dire Dawa')).toEqual({ region: 'Dire Dawa', city: 'Dire Dawa' });
  });

  it('handles region aliases and unknown locations', () => {
    expect(resolveLocation('Finfinne').region).toBe('Oromia');
    expect(resolveLocation('A.A Ethiopia').region).toBe('Addis Ababa');
    expect(resolveLocation('Remote / Anywhere').region).toBe('Unknown');
    expect(resolveLocation('').region).toBe('Unknown');
  });
});

describe('job normalizer', () => {
  it('infers sector and education level from description text', () => {
    expect(inferSector('Senior frontend software developer')).toBe('ICT & Software');
    expect(inferSector('Humanitarian programme officer UNICEF partner')).toBe('NGO & Humanitarian');
    expect(inferSector('Registered nurse for clinic')).toBe('Health & Medical');
    expect(inferEducationLevel('Requires a master degree')).toBe('MASTER');
    expect(inferEducationLevel('BSc degree or bachelor')).toBe('BACHELOR');
    expect(inferEducationLevel('TVET level IV certificate')).toBe('TVET');
    expect(inferEducationLevel('Grade 12 completion')).toBe('GRADE_10_12');
    expect(inferEducationLevel('No degree mentioned')).toBe('NOT_SPECIFIED');
    expect(inferEmploymentType('6-month internship program')).toBe('INTERNSHIP');
  });

  it('maps raw source data to unified Job entity and NEVER invents missing data', () => {
    const job = normalizeJob({
      url: 'https://example.com/job/1',
      title: ' Accountant ',
      employer: ' Ethio Telecom PLC ',
      locationRaw: 'Adama',
      descriptionPlain: 'Bank reconciliations and accounting duties.',
    });
    expect(job.title).toBe('Accountant');
    expect(job.employer).toBe('Ethio Telecom PLC');
    expect(job.region).toBe('Oromia');
    expect(job.city).toBe('Adama');
    expect(job.locationRaw).toBe('Adama');
    expect(job.salaryMin).toBeUndefined(); // never invented
    expect(job.deadline).toBeUndefined(); // never invented
    expect(job.currency).toBe('ETB');
    expect(job.sector).toBe('Finance & Banking');
    expect(job.expirationStatus).toBe('ACTIVE');
  });

  it('marks jobs with past deadlines as EXPIRED', () => {
    const job = normalizeJob({
      url: 'https://example.com/job/2',
      title: 'Tester',
      locationRaw: 'Addis Ababa',
      deadline: '2020-01-01',
    });
    expect(job.expirationStatus).toBe('EXPIRED');
  });
});
