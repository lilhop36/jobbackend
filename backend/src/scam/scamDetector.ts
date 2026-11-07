// JobHunter Ethiopia — Evidence-based Job Scam Detection (Section 12)
// Every flag explains why; no accusations without evidence.
import { NormalizedJob, RiskAssessment } from '../types/index.js';

interface Rule {
  code: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  check: (job: NormalizedJob, text: string) => { hit: boolean; reason: string; evidence?: string };
}

const FREE_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'mail.ru'];

export const RULES: Rule[] = [
  {
    code: 'UPFRONT_FEE_REQUEST',
    severity: 'HIGH',
    check: (_job, text) => {
      const patterns = [
        /(?:registration|processing|application|training|placement|interview)\s+fee/i,
        /pay\s+(?:birr|etb|\$\d+|\d+\s*birr)/i,
        /send\s+money\s+(?:to|via)/i,
        /money\s*gram|western\s*union|telebirr.*send/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m) {
          return {
            hit: true,
            reason:
              'The listing appears to ask for an upfront payment. Legitimate employers in Ethiopia almost never charge job seekers application fees.',
            evidence: m[0],
          };
        }
      }
      return { hit: false, reason: '' };
    },
  },
  {
    code: 'FINANCIAL_INFO_REQUEST',
    severity: 'HIGH',
    check: (_job, text) => {
      const m = text.match(/bank\s*account\s*(?:number|details)|credit\s*card|upload.*(?:id card|passport).*(?:before|to apply)/i);
      return {
        hit: !!m,
        reason:
          'The listing requests banking details or identity documents before an application or interview. Never share payment information during job applications.',
        evidence: m?.[0],
      };
    },
  },
  {
    code: 'SUSPICIOUS_EMPLOYER_EMAIL',
    severity: 'MEDIUM',
    check: (_job, text) => {
      const emails = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/g) ?? [];
      const free = emails.find((e) => FREE_EMAIL_DOMAINS.some((d) => e.toLowerCase().endsWith(d)));
      const isBigEmployer = /bank|telecom|airlines|hospital|university|ministry/i.test(_job.employer);
      if (free && isBigEmployer) {
        return {
          hit: true,
          reason:
            'A large organization listing lists a free webmail address (e.g. Gmail) instead of a corporate domain. Verify the email with the employer directly.',
          evidence: free,
        };
      }
      return { hit: false, reason: '' };
    },
  },
  {
    code: 'SUSPICIOUS_APPLICATION_LINK',
    severity: 'HIGH',
    check: (job) => {
      const url = job.applicationUrl || job.originalUrl;
      const m = url.match(/^https?:\/\/(?:www\.)?(bit\.ly|tinyurl\.com|t\.co|goo\.gl|cutt\.ly|rb\.gy)\//i);
      return {
        hit: !!m,
        reason:
          'The application link uses a URL shortener, which can hide the real destination. Only follow links you trust.',
        evidence: m?.[0],
      };
    },
  },
  {
    code: 'UNREALISTIC_SALARY',
    severity: 'MEDIUM',
    check: (job) => {
      const salary = job.salaryMin ?? job.salaryMax;
      if (salary && salary > 10_000_000) {
        return {
          hit: true,
          reason: `The advertised salary (${salary.toLocaleString()} ETB) is unusually high for this market. Verify the figure directly with the employer.`,
          evidence: String(salary),
        };
      }
      return { hit: false, reason: '' };
    },
  },
  {
    code: 'MISSING_EMPLOYER_INFO',
    severity: 'LOW',
    check: (job) => {
      const noEmp = !job.employer || job.employer === 'Employer not specified';
      const noSite = !job.employerWebsite;
      const noPhone = !job.applicationInstructions?.match(/(?:\+251|09|07)\d/);
      if (noEmp && noSite && noPhone) {
        return {
          hit: true,
          reason:
            'The listing does not identify the employer or provide contact details. Research the employer before applying.',
        };
      }
      return { hit: false, reason: '' };
    },
  },
];

export function assessJobRisk(job: NormalizedJob): RiskAssessment {
  const text = `${job.title} ${job.description} ${job.applicationInstructions || ''} ${job.employer}`;
  const flags = RULES.map((r) => {
    const res = r.check(job, text);
    return res.hit ? { code: r.code, severity: r.severity, reason: res.reason, evidence: res.evidence } : null;
  }).filter(Boolean) as RiskAssessment['flags'];

  const hasHigh = flags.some((f) => f.severity === 'HIGH');
  const hasMed = flags.some((f) => f.severity === 'MEDIUM');
  return {
    riskLevel: hasHigh ? 'HIGH' : hasMed ? 'MEDIUM' : 'LOW',
    flags,
  };
}
