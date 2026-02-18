// Phone & address normalization + matching utilities

export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits.slice(-10);
}

export function normalizeAddress(addr: string | null | undefined): string {
  if (!addr) return '';
  let s = addr.toLowerCase().trim();
  // Remove unit/apt/suite suffixes
  s = s.replace(/\b(apt|apartment|unit|suite|ste|#)\s*[a-z0-9#-]*/gi, '');
  // Common abbreviations
  s = s.replace(/\bstreet\b/g, 'st')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\broad\b/g, 'rd')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\bcircle\b/g, 'cir')
    .replace(/\bplace\b/g, 'pl')
    .replace(/\bparkway\b/g, 'pkwy')
    .replace(/\bway\b/g, 'way')
    .replace(/\bnorth\b/g, 'n')
    .replace(/\bsouth\b/g, 's')
    .replace(/\beast\b/g, 'e')
    .replace(/\bwest\b/g, 'w');
  // Strip zip code
  s = s.replace(/\b\d{5}(-\d{4})?\b/g, '');
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function addressMatch(a: string, b: string): boolean {
  const na = normalizeAddress(a);
  const nb = normalizeAddress(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Extract street number + first word of street name
  const extractKey = (s: string) => {
    const m = s.match(/^(\d+)\s+(\S+)/);
    return m ? `${m[1]} ${m[2]}` : '';
  };
  const ka = extractKey(na);
  const kb = extractKey(nb);
  return ka !== '' && ka === kb;
}

export function fuzzyNameMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return true;
  // Check last name match + first name starts with
  const pa = na.split(/\s+/);
  const pb = nb.split(/\s+/);
  if (pa.length >= 2 && pb.length >= 2) {
    const lastA = pa[pa.length - 1];
    const lastB = pb[pb.length - 1];
    if (lastA === lastB && (pa[0].startsWith(pb[0]) || pb[0].startsWith(pa[0]))) return true;
  }
  return false;
}
