// ---------------------------------------------------------------------------
// Sitecore date string parser
// Sitecore stores dates as "20240115T103000Z" — not ISO 8601.
// ---------------------------------------------------------------------------

/**
 * Parse a Sitecore date string ("20240115T103000Z") into a JS Date.
 * Returns null for empty / invalid strings.
 */
export function parseSitecoreDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;

  // Format: YYYYMMDDTHHmmssZ  (no dashes, no colons)
  const match = raw.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/
  );

  if (!match) {
    // Fall back to native parser (handles ISO 8601 too)
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const [, y, mo, d, h, mi, s] = match;
  return new Date(
    Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s)
    )
  );
}

/**
 * Format a date to a human-friendly locale string.
 * Example: "1/15/2024, 10:30:00 AM"
 */
export function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Format a Sitecore date string directly.
 */
export function formatSitecoreDate(raw: string | undefined | null): string {
  return formatDate(parseSitecoreDate(raw));
}
