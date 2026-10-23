/** SHA-256 of a trimmed, lowercased value, hex encoded (the format Meta and TikTok expect). */
export async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Parses a JSON map setting like {"peta-rezeki":"123"}; returns the value for one bet. */
export function idFor(json: string | undefined, bet: string): string | undefined {
  if (!json) return undefined;
  try {
    const v = (JSON.parse(json) as Record<string, string>)[bet];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  } catch {
    return undefined;
  }
}
