// API Keys and config
export const REPCARD_API_KEY = process.env.REPCARD_API_KEY || '';
export const QB_API_TOKEN = process.env.QB_API_TOKEN || '';
export const QB_REALM = 'kin.quickbase.com';
export const QB_PROJECTS_TABLE = 'br9kwm8na';

// RepCard "Team" = our Office, RepCard "Office" = our Region
export const OFFICE_MAPPING: Record<number, { name: string; qbName: string; region: string; active: boolean }> = {
  5671: { name: 'Stevens - Team 2026', qbName: 'Stevens - Iowa 2025', region: 'Bitton Region', active: true },
  6737: { name: 'Bitton - Team 2026', qbName: 'Stevens - Iowa 2025', region: 'Bitton Region', active: true }, // rolls into Stevens
  7141: { name: 'Johnson - Team 2026', qbName: 'Stevens - Iowa 2025', region: 'Bitton Region', active: true }, // rolls into Stevens
  4714: { name: 'Pre Richards 2025', qbName: '_regional_', region: 'Richards Region', active: true }, // Addison Richards, regional
  5818: { name: 'Bontrager - Fort Myers 2026', qbName: 'Bontrager - Cincinnati 2025', region: 'Richards Region', active: true },
  5674: { name: 'Molina - Tampa Bay 2026', qbName: 'Molina - KC 2025', region: 'Richards Region', active: true },
  5822: { name: 'Douglass - Winter Haven 2026', qbName: 'Douglass - Winter Haven 2025', region: 'Dynasty Region', active: true },
  5823: { name: 'Free - Elevate Orlando 2026', qbName: 'Elevate - Orlando East 2025', region: 'Dynasty Region', active: true },
  5824: { name: 'Allen - Orlando 2026', qbName: 'Allen - Orlando West 2025', region: 'Dynasty Region', active: true },
  6311: { name: 'Champagne - Panama City 2026', qbName: 'Champagne - Panama City 2025', region: 'Champagne Dynasty', active: true },
  6923: { name: 'Adams - San Jose 2025', qbName: 'Adams - San Jose 2025', region: 'Adams Region', active: true },
  // Inactive
  5673: { name: 'Sawade - Louisville 2025', qbName: '', region: 'Richards Region', active: false },
  5675: { name: 'Bryant - Columbus 2025', qbName: '', region: 'Richards Region', active: false },
  6312: { name: 'Scariano - Crestview 2025', qbName: '', region: 'Champagne Dynasty', active: false },
  6714: { name: 'Brewton - Ohio 2025', qbName: '', region: 'The Ohio State', active: false },
  6715: { name: 'West - SoCal 2025', qbName: '', region: 'Dwest Region', active: false },
};

// Get display name for an office (QB-normalized)
export function getOfficeName(teamId: number): string {
  const mapping = OFFICE_MAPPING[teamId];
  if (!mapping) return `Unknown (${teamId})`;
  return mapping.qbName || mapping.name;
}

// Get all active QB office names (deduplicated)
export function getActiveOffices(): string[] {
  const offices = new Set<string>();
  Object.values(OFFICE_MAPPING)
    .filter(m => m.active && m.qbName && m.qbName !== '_regional_')
    .forEach(m => offices.add(m.qbName));
  return Array.from(offices).sort();
}

// Map RepCard team IDs to QB office name
export function teamIdToQBOffice(teamId: number): string | null {
  const mapping = OFFICE_MAPPING[teamId];
  if (!mapping || !mapping.active || mapping.qbName === '_regional_') return null;
  return mapping.qbName;
}
