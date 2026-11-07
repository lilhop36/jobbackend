// JobHunter Ethiopia — Ethiopian regions & cities taxonomy
// 14 regions per product spec Section 8

export const ETHIOPIAN_REGIONS = [
  'Addis Ababa',
  'Oromia',
  'Amhara',
  'Sidama',
  'Tigray',
  'Somali',
  'Afar',
  'Benishangul-Gumuz',
  'Gambela',
  'Central Ethiopia',
  'South Ethiopia',
  'Southwest Ethiopia',
  'Harari',
  'Dire Dawa',
] as const;

export type EthiopianRegion = typeof ETHIOPIAN_REGIONS[number];

export const MAJOR_CITIES: Array<{ name: string; region: EthiopianRegion }> = [
  { name: 'Addis Ababa', region: 'Addis Ababa' },
  { name: 'Adama', region: 'Oromia' },
  { name: 'Hawassa', region: 'Sidama' },
  { name: 'Bahir Dar', region: 'Amhara' },
  { name: 'Jimma', region: 'Oromia' },
  { name: 'Dire Dawa', region: 'Dire Dawa' },
  { name: 'Mekelle', region: 'Tigray' },
  { name: 'Shashemene', region: 'Oromia' },
  { name: 'Bishoftu', region: 'Oromia' },
  { name: 'Harar', region: 'Harari' },
  { name: 'Jijiga', region: 'Somali' },
  { name: 'Semera', region: 'Afar' },
  { name: 'Asosa', region: 'Benishangul-Gumuz' },
  { name: 'Gambela', region: 'Gambela' },
  { name: 'Hosanna', region: 'Central Ethiopia' },
  { name: 'Arba Minch', region: 'South Ethiopia' },
  { name: 'Wolaita Sodo', region: 'South Ethiopia' },
  { name: 'Bonga', region: 'Southwest Ethiopia' },
  { name: 'Dessie', region: 'Amhara' },
  { name: 'Gondar', region: 'Amhara' },
];

/**
 * Maps a free-form location string to an Ethiopian region and city.
 * Always preserves the original location string (spec Section 8).
 */
export function resolveLocation(raw: string): { region: EthiopianRegion | 'Unknown'; city?: string } {
  if (!raw || !raw.trim()) return { region: 'Unknown' };
  const lower = raw.toLowerCase();

  // Try city match first (more specific)
  for (const c of MAJOR_CITIES) {
    if (lower.includes(c.name.toLowerCase())) {
      return { region: c.region, city: c.name };
    }
  }

  // Try region match
  for (const r of ETHIOPIAN_REGIONS) {
    if (lower.includes(r.toLowerCase())) {
      return { region: r };
    }
  }

  // Common aliases
  if (lower.includes('finfinne')) return { region: 'Oromia' };
  if (lower.includes('aa') || lower.includes('a.a')) return { region: 'Addis Ababa' };

  return { region: 'Unknown' };
}
