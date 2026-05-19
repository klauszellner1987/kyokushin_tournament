export function toISO(de: string): string {
  const parts = de.split('.');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return '';
}

export function toDE(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return iso;
}

export function parseDateDE(input: string): string {
  return toISO(input) || input;
}

export function formatDateDE(iso: string): string {
  return toDE(iso);
}
