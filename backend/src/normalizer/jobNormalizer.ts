// JobHunter Ethiopia — Job Normalizer
// Maps raw source data → unified NormalizedJob entity per Section 9.
// Rule: NEVER invent missing salary, deadline, or employer information. Null = unknown.
import { RawJobListing, NormalizedJob } from '../types/index.js';
import { resolveLocation } from './ethiopianLocations.js';

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#8211;|&#8212;/g, '–')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#038;|&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#\d+;/g, '');
}

const SECTOR_KEYWORDS: Array<{ sector: string; keywords: string[] }> = [
  { sector: 'ICT & Software', keywords: ['developer', 'software', 'programmer', 'it ', 'ict', 'engineer (software', 'data analyst', 'network', 'system admin', 'frontend', 'backend', 'fullstack', 'qa', 'devops', 'cyber'] },
  { sector: 'NGO & Humanitarian', keywords: ['ngo', 'humanitarian', 'un ', 'unicef', 'undp', 'who', 'relief', 'programme officer', 'project officer', 'emergency', 'refugee', 'protection officer'] },
  { sector: 'Health & Medical', keywords: ['health', 'medical', 'nurse', 'doctor', 'physician', 'hospital', 'clinic', 'pharmacy', 'pharmacist', 'lab technician', 'public health'] },
  { sector: 'Finance & Banking', keywords: ['bank', 'finance', 'accountant', 'accounting', 'auditor', 'credit officer', 'teller', 'loan', 'cbe', 'awash', 'dashen', 'insurance'] },
  { sector: 'Education & Teaching', keywords: ['teacher', 'teaching', 'lecturer', 'professor', 'school', 'university', 'instructor', 'tutor', 'education'] },
  { sector: 'Engineering & Construction', keywords: ['civil engineer', 'mechanical', 'electrical engineer', 'construction', 'architect', 'surveyor', 'contractor'] },
  { sector: 'Sales & Marketing', keywords: ['marketing', 'sales', 'business development', 'brand', 'digital marketing', 'advertising'] },
  { sector: 'Agriculture & Environment', keywords: ['agriculture', 'agronomist', 'forestry', 'environmental', 'horticulture', 'farm'] },
  { sector: 'Transport & Logistics', keywords: ['driver', 'logistics', 'transport', 'supply chain', 'warehouse', 'fleet'] },
  { sector: 'Government & Public Sector', keywords: ['public service', 'ministry', 'municipality', 'government', 'civil service', 'psc'] },
  { sector: 'Hotel & Hospitality', keywords: ['hotel', 'hospitality', 'waiter', 'cook', 'chef', 'restaurant', 'tourism'] },
  { sector: 'Customer Service', keywords: ['customer service', 'call center', 'front desk', 'receptionist'] },
  { sector: 'Internships & Entry-Level', keywords: ['intern', 'internship', 'graduate trainee', 'entry-level', 'fresh graduate', 'trainee', 'apprentice'] },
  { sector: 'Legal & Law', keywords: ['lawyer', 'legal', 'advocate', 'attorney', 'paralegal'] },
  { sector: 'Manufacturing & Trades', keywords: ['factory', 'machine operator', 'welder', 'electrician', 'technician', 'manufacturing', 'production line'] },
];

export function inferSector(text: string): string {
  const lower = text.toLowerCase();
  for (const s of SECTOR_KEYWORDS) {
    if (s.keywords.some((kw) => lower.includes(kw))) return s.sector;
  }
  return 'Other';
}

export function inferEducationLevel(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('phd') || lower.includes('doctorate')) return 'PHD';
  if (lower.includes('master') || lower.includes('msc') || lower.includes('ma degree')) return 'MASTER';
  if (lower.includes('bachelor') || lower.includes('bsc') || lower.includes('ba degree') || lower.includes('first degree')) return 'BACHELOR';
  if (lower.includes('diploma')) return 'DIPLOMA';
  if (lower.includes('tvet') || lower.includes('tvt') || lower.includes('level iv') || lower.includes('level 4')) return 'TVET';
  if (lower.includes('grade 12') || lower.includes('grade 10') || lower.includes('high school')) return 'GRADE_10_12';
  return 'NOT_SPECIFIED';
}

export function inferEmploymentType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('internship') || lower.includes('intern')) return 'INTERNSHIP';
  if (lower.includes('part-time') || lower.includes('part time')) return 'PART_TIME';
  if (lower.includes('contract') || lower.includes('fixed-term') || lower.includes('fixed term')) return 'CONTRACT';
  if (lower.includes('temporary')) return 'TEMPORARY';
  if (lower.includes('volunteer')) return 'VOLUNTEER';
  if (lower.includes('full-time') || lower.includes('full time') || lower.includes('permanent')) return 'FULL_TIME';
  return 'FULL_TIME';
}

function parseDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? undefined : d;
}

export function normalizeJob(raw: RawJobListing, defaultSourceId?: string, defaultSourceName?: string): NormalizedJob {
  const combinedText = [raw.title, raw.description, raw.requirements, raw.employer].filter(Boolean).join(' ');
  const loc = resolveLocation(raw.locationRaw);

  const published = parseDate(raw.publishedAt);
  const deadline = parseDate(raw.deadline);

  // Compute expiration status
  let expirationStatus: NormalizedJob['expirationStatus'] = 'ACTIVE';
  if (deadline && deadline.getTime() < Date.now()) expirationStatus = 'EXPIRED';

  const sourceAttribution = raw.sourceAttribution || defaultSourceName || defaultSourceId || 'Unknown source';

  return {
    title: decodeHtmlEntities((raw.title || '').trim()),
    employer: decodeHtmlEntities((raw.employer || 'Employer not specified').trim()),
    description: (raw.description || '').trim(),
    descriptionPlain: raw.descriptionPlain ? decodeHtmlEntities(raw.descriptionPlain.trim()) : undefined,
    skills: raw.skills ?? [],
    sector: raw.sector || inferSector(combinedText),
    region: loc.region,
    city: loc.city || raw.city,
    locationRaw: (raw.locationRaw || '').trim(),
    employmentType: raw.employmentType || inferEmploymentType(combinedText),
    experienceLevel: raw.experienceLevel,
    educationLevel: raw.educationLevel || inferEducationLevel(combinedText),
    salaryMin: raw.salaryMin,
    salaryMax: raw.salaryMax,
    currency: raw.currency || 'ETB',
    salaryRaw: raw.salaryRaw ? decodeHtmlEntities(raw.salaryRaw) : undefined,
    publishedAt: published,
    deadline,
    originalUrl: raw.url,
    applicationUrl: raw.applicationUrl || raw.url,
    applicationMethod: raw.applicationMethod || (raw.applicationUrl ? 'URL' : undefined),
    applicationInstructions: raw.applicationInstructions,
    sourceAttribution,
    sourceId: defaultSourceId || 'unknown',
    sourceJobId: raw.sourceJobId,
    verificationStatus: 'UNVERIFIED',
    expirationStatus,
  };
}
