import type { Env } from './env';
import { SITE } from '../shared/site';

export interface ReportEmail {
  to: string;
  name: string;
  brand: string;
  reportUrl: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Subject, HTML and plain text for the "your report is ready" email. Exported for unit tests. */
export function reportEmailContent(e: ReportEmail) {
  const first = e.name.trim().split(/\s+/)[0] || 'Kak';
  const subject = `Laporan ${e.brand} kamu sudah siap`;
  const text = [
    `Halo ${first},`,
    '',
    `Terima kasih, pembayaranmu sudah kami terima. Laporan ${e.brand} kamu bisa dibuka kapan saja lewat link ini:`,
    e.reportUrl,
    '',
    'Simpan email ini supaya laporannya mudah dibuka lagi. Di halaman laporan ada tombol "Simpan PDF" kalau kamu ingin menyimpannya di HP.',
    '',
    `Ada pertanyaan atau kendala? Balas email ini atau tulis ke ${SITE.contactEmail}.`,
    '',
    `Salam,`,
    `${e.brand} by ${SITE.operator}`,
  ].join('\n');
  const html = `<!doctype html><html lang="id"><body style="margin:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#1f2a24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-weight:bold;font-size:15px;padding-bottom:18px">${esc(e.brand)}</td></tr>
<tr><td style="font-size:22px;font-weight:bold;line-height:1.3;padding-bottom:12px">Laporanmu sudah siap, ${esc(first)}</td></tr>
<tr><td style="font-size:16px;line-height:1.6;padding-bottom:22px">Terima kasih, pembayaranmu sudah kami terima. Laporan lengkapmu bisa dibuka kapan saja lewat tombol di bawah.</td></tr>
<tr><td style="padding-bottom:22px"><a href="${esc(e.reportUrl)}" style="display:inline-block;background:#1f6f50;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 22px;border-radius:12px">Buka laporanku</a></td></tr>
<tr><td style="font-size:14px;line-height:1.6;color:#6b7268;padding-bottom:8px">Simpan email ini supaya laporannya mudah dibuka lagi. Kalau tombol tidak berfungsi, salin link ini:<br><a href="${esc(e.reportUrl)}" style="color:#1f6f50;word-break:break-all">${esc(e.reportUrl)}</a></td></tr>
<tr><td style="font-size:14px;line-height:1.6;color:#6b7268">Ada pertanyaan? Balas email ini atau tulis ke ${esc(SITE.contactEmail)}.</td></tr>
</table>
<p style="font-size:12px;color:#8a8f86;margin:16px 0 0">${esc(e.brand)} oleh ${esc(SITE.operator)}</p>
</td></tr></table></body></html>`;
  return { subject, text, html };
}

/** True when email sending is configured. */
export const emailEnabled = (env: Env) => !!(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());

/** Sends the report-link email through Resend. Throws on failure. */
export async function sendReportEmail(env: Env, e: ReportEmail, idempotencyKey?: string): Promise<void> {
  const { subject, text, html } = reportEmailContent(e);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY!.trim()}` };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`${env.EMAIL_API_BASE || 'https://api.resend.com'}/emails`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: `${e.brand} <${env.EMAIL_FROM!.trim()}>`,
      to: [e.to],
      reply_to: SITE.contactEmail,
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
