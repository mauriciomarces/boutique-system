export function localDateKey(value?: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function matchesLocalDateRange(
  value: string | null | undefined,
  from: string,
  to: string,
): boolean {
  if (!from && !to) return true;
  const date = localDateKey(value);
  return Boolean(date && (!from || date >= from) && (!to || date <= to));
}
