import { describe, expect, it } from 'vitest';
import { tiktokPurchaseBody } from '../../src/worker/tiktok';
import { reportEmailContent } from '../../src/worker/email';
import { sha256 } from '../../src/worker/hash';
import { idFor } from '../../src/worker/hash';

const order = {
  bet: 'peta-rezeki', amount: 99000, email: ' Budi@Example.com ', mobile: '0812-3456-7890', event_id: 'pur_abc',
  client_json: JSON.stringify({ ip: '1.2.3.4', ua: 'UA', ttp: 'ttp-cookie', ttclid: 'click-1', url: 'https://x.id/peta-rezeki/hasil/1' }),
  paid_at: 1_700_000_000_000,
};

describe('TikTok Events API body', () => {
  it('uses CompletePayment, the shared event id, and hashed contact details', async () => {
    const b = await tiktokPurchaseBody('PIXEL1', order, 'https://fallback');
    expect(b.event_source).toBe('web');
    expect(b.event_source_id).toBe('PIXEL1');
    const d = b.data[0];
    expect(d.event).toBe('CompletePayment');
    expect(d.event_id).toBe('pur_abc');
    expect(d.event_time).toBe(1_700_000_000);
    expect(d.user.email).toBe(await sha256('budi@example.com'));
    expect(d.user.phone).toBe(await sha256('+6281234567890'));
    expect(d.user.email).toMatch(/^[0-9a-f]{64}$/);
    expect(d.user).toMatchObject({ ttclid: 'click-1', ttp: 'ttp-cookie', ip: '1.2.3.4', user_agent: 'UA' });
    expect(d.page.url).toBe('https://x.id/peta-rezeki/hasil/1');
    expect(d.properties).toMatchObject({ currency: 'IDR', value: 99000 });
    expect(JSON.stringify(b)).not.toContain('Budi'); // no raw personal data
  });

  it('omits missing click data instead of sending empty strings', async () => {
    const b = await tiktokPurchaseBody('P', { ...order, client_json: null, email: null, mobile: null }, 'https://fallback/peta-rezeki');
    expect(b.data[0].user).toEqual({});
    expect(b.data[0].page.url).toBe('https://fallback/peta-rezeki');
  });
});

describe('pixel id settings', () => {
  it('reads per-bet ids and survives bad JSON', () => {
    expect(idFor('{"peta-rezeki":" C123 "}', 'peta-rezeki')).toBe('C123');
    expect(idFor('{"peta-rezeki":"C123"}', 'siap-nikah')).toBeUndefined();
    expect(idFor('not json', 'peta-rezeki')).toBeUndefined();
    expect(idFor(undefined, 'peta-rezeki')).toBeUndefined();
  });
});

describe('report email', () => {
  const e = { to: 'a@b.id', name: 'Dimas Pratama', brand: 'Peta Rezeki', reportUrl: 'https://petarezeki.id/r/tok123' };
  it('greets by first name and contains the report link in both versions', () => {
    const c = reportEmailContent(e);
    expect(c.subject).toBe('Laporan Peta Rezeki kamu sudah siap');
    expect(c.text).toContain('Halo Dimas,');
    expect(c.text).toContain(e.reportUrl);
    expect(c.html).toContain(`href="${e.reportUrl}"`);
    expect(c.html).toContain('Buka laporanku');
  });
  it('escapes names so buyer input cannot inject HTML', () => {
    const c = reportEmailContent({ ...e, name: '<script>x</script>' });
    expect(c.html).not.toContain('<script>');
    expect(c.html).toContain('&lt;script&gt;');
  });
  it('handles an empty name', () => {
    expect(reportEmailContent({ ...e, name: '  ' }).text).toContain('Halo Kak,');
  });
});
