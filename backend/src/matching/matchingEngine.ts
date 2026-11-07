// JobHunter Ethiopia — Matching Engine (Section 7)
// Transparent, decomposed 0–100 match score with missing/partial/unknown
// requirements, potential disqualifiers, and an explicit non-probability disclaimer.
// Hard rules: never claim eligibility when essential info is missing; never invent CV facts.
import { NormalizedJob, ExtractedCv, MatchResult, MatchScoreDimension } from '../types/index.js';

const EDU_RANKS: Record<string, number> = {
  GRADE_10_12: 1,
  TVET: 2,
  DIPLOMA: 3,
  BACHELOR: 4,
  MASTER: 5,
  PHD: 6,
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(' ')
      .filter((w) => w.length > 2)
  );
}

function synonymMatch(a: string, b: string): boolean {
  const ta = tokenize(a);
  const tb = tokenize(b);
  for (const w of ta) if (tb.has(w)) return true;
  return false;
}

export function computeMatchScore(cv: ExtractedCv, job: NormalizedJob): MatchResult {
  const dimensions: MatchScoreDimension[] = [];
  const strong: string[] = [];
  const missing: string[] = [];
  const partial: string[] = [];
  const unknownReq: string[] = [];
  const disqualifiers: string[] = [];

  // 1. Education (15)
  const reqEdu = job.educationLevel || 'NOT_SPECIFIED';
  let eduScore = 15;
  if (reqEdu === 'NOT_SPECIFIED') {
    unknownReq.push('Education requirement not specified by employer');
    eduScore = 15;
  } else {
    const candidateRanks = (cv.education ?? []).map((e) => EDU_RANKS[e.level?.toUpperCase() || ''] ?? 0);
    const top = candidateRanks.length ? Math.max(...candidateRanks) : 0;
    const needed = EDU_RANKS[reqEdu.toUpperCase()] ?? 4;
    if (top >= needed) {
      eduScore = 15;
      strong.push(`Meets or exceeds required education (${reqEdu})`);
    } else if (top > 0) {
      eduScore = 7;
      partial.push(`Education below listed requirement (${reqEdu})`);
      disqualifiers.push(`Education: listing requests ${reqEdu}`);
    } else {
      eduScore = 0;
      missing.push(`No education level listed on CV (job asks for ${reqEdu})`);
      disqualifiers.push(`Education: listing requests ${reqEdu}`);
    }
  }
  dimensions.push({ name: 'Education', score: eduScore, maxScore: 15, notes: `Required: ${reqEdu}` });

  // 2. Required skills (30)
  const cvSkillNames = (cv.skills ?? []).map((s) => s.name);
  const rawJobSkills = Array.isArray(job.skills)
    ? job.skills
    : typeof (job as any).skills === 'string' && (job as any).skills
    ? String((job as any).skills).split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const reqSkills = rawJobSkills.length ? rawJobSkills : (job.requirements?.requiredSkills ?? []);
  let skillsScore = 30;
  if (reqSkills.length === 0) {
    unknownReq.push('Required skills not explicitly listed by employer');
  } else {
    let matched = 0;
    for (const r of reqSkills) {
      const found = cvSkillNames.some((cs) => normalize(cs).includes(normalize(r)) || normalize(r).includes(normalize(cs)) || synonymMatch(cs, r));
      if (found) {
        matched++;
        strong.push(`Skill match: ${r}`);
      } else {
        missing.push(`Missing required skill: ${r}`);
      }
    }
    skillsScore = Math.round((matched / reqSkills.length) * 30);
    if (skillsScore < 10) disqualifiers.push('Few required skills matched');
  }
  dimensions.push({ name: 'Required Skills', score: skillsScore, maxScore: 30, notes: `${reqSkills.length} listed` });

  // 3. Preferred skills (10)
  const prefSkills = job.requirements?.preferredSkills ?? [];
  let prefScore = 5;
  if (prefSkills.length) {
    const matched = prefSkills.filter((p) => cvSkillNames.some((cs) => normalize(cs).includes(normalize(p)))).length;
    prefScore = Math.round((matched / prefSkills.length) * 10);
    if (prefScore > 0) strong.push(`Preferred skills matched: ${matched}/${prefSkills.length}`);
  }
  dimensions.push({ name: 'Preferred Skills', score: prefScore, maxScore: 10, notes: `${prefSkills.length} listed` });

  // 4. Experience (20)
  const expText = [job.experienceLevel, job.descriptionPlain].filter(Boolean).join(' ');
  const mYears = expText.match(/(\d+)\+?\s*(?:-\s*(\d+)\s*)?years?\s*(?:of\s*)?experience/i);
  let expScore = 15;
  if (mYears) {
    const needed = Number(mYears[1]);
    const candYears = (cv.experience ?? []).length * 1.5;
    if (candYears >= needed) {
      expScore = 20;
      strong.push(`Experience meets stated ${needed}+ years requirement`);
    } else if (candYears > 0) {
      expScore = Math.min(20, Math.round((candYears / needed) * 20));
      partial.push(`Experience (~${candYears} yrs heuristic) below requested ${needed}+ years`);
    } else {
      expScore = 0;
      missing.push(`No experience listed; job asks ~${needed}+ years`);
      disqualifiers.push(`Experience requirement: ~${needed}+ years`);
    }
  } else {
    unknownReq.push('Experience requirement not explicitly specified');
  }
  dimensions.push({ name: 'Experience', score: expScore, maxScore: 20, notes: mYears ? `${mYears[0]}` : 'not specified' });

  // 5. Professional qualifications (10)
  const certs = cv.certifications ?? [];
  const reqCerts = job.requirements?.certifications ?? [];
  let certScore = 5;
  if (reqCerts.length) {
    const matched = reqCerts.filter((rc) => certs.some((c) => normalize(c).includes(normalize(rc)))).length;
    certScore = Math.round((matched / reqCerts.length) * 10);
    if (certScore === 0) missing.push(`Certification needed: ${reqCerts.join(', ')}`);
  }
  dimensions.push({ name: 'Qualifications', score: certScore, maxScore: 10, notes: `${reqCerts.length} listed` });

  // 6. Location (5)
  let locScore = 5;
  if (cv.location && job.region !== 'Unknown') {
    const same = normalize(cv.location).includes(normalize(job.region)) || (job.city && normalize(cv.location).includes(normalize(job.city)));
    locScore = same ? 5 : 2;
    if (!same) partial.push(`Job located in ${job.city || job.region}; CV location is ${cv.location}`);
  }
  dimensions.push({ name: 'Location', score: locScore, maxScore: 5, notes: job.city ? `${job.city}, ${job.region}` : job.region });

  // 7. Language (5)
  const reqLang = job.requirements?.languages ?? [];
  let langScore = 5;
  if (reqLang.length) {
    const cvLang = cv.languages ?? [];
    const matched = reqLang.filter((l) => cvLang.some((cl) => normalize(cl).includes(normalize(l)))).length;
    langScore = Math.round((matched / reqLang.length) * 5);
    if (langScore < 5) partial.push(`Language requirements: ${reqLang.join(', ')}`);
  }
  dimensions.push({ name: 'Languages', score: langScore, maxScore: 5, notes: reqLang.join(', ') || 'not specified' });

  // 8. Other criteria (5)
  let otherScore = 5;
  if (job.sector === 'Internships & Entry-Level' && (cv.experience ?? []).length === 0) {
    strong.push('Entry-level opportunity well-suited for early-career profile');
  }
  dimensions.push({ name: 'Fit & Sector', score: otherScore, maxScore: 5, notes: job.sector });

  const overallScore = Math.min(100, dimensions.reduce((a, b) => a + b.score, 0));

  return {
    overallScore,
    dimensions,
    strongMatches: strong,
    missingRequirements: missing,
    partialRequirements: partial,
    unknownRequirements: unknownReq,
    disqualifiers,
    disclaimer:
      'This match score is an automated compatibility estimate, NOT a probability of employment. Hard requirements are separated from preferences above. Verify requirements with the employer before applying.',
  };
}
