import { describe, expect, it } from 'vitest';
import { weton } from '../src/shared/scoring';
import { petaRezeki, _internal } from '../src/bets/peta-rezeki';
import { parseReport } from '../src/worker/ai';
import { normalizeMobile } from '../src/worker/payments';
import type { Answers } from '../src/shared/types';

const base: Answers = { status: 'employee', m1: 'a', m2: 'a', m3: 'a', m4: 'a', capital: '1to10', hours: '5to10' };
const allOption = (id: string): Answers => Object.fromEntries(['q1','q2','q3','q4','q5','q6','q7','q8','q9','q10'].map((q) => [q, id]));

describe('weton', () => {
  it('anchors 17 Aug 1945 as Jumat Legi', () => {
    expect(weton('1945-08-17')).toMatchObject({ label: 'Jumat Legi', neptu: 11 });
  });
  it('advances pasaran every day in a 5-day cycle', () => {
    expect(weton('1945-08-18')?.pasaran).toBe('Pahing');
    expect(weton('1945-08-22')?.pasaran).toBe('Legi');
    expect(weton('1945-08-16')?.pasaran).toBe('Kliwon');
  });
  it('rejects bad input', () => { expect(weton('17/08/1945')).toBeNull(); });
});

describe('peta rezeki scoring', () => {
  it('is deterministic and every option set maps to a known profile', () => {
    for (const opt of ['a', 'b', 'c', 'd']) {
      for (const risk of ['a', 'c']) {
        const ans = { ...base, ...allOption(opt), m1: risk, m2: risk, m3: risk };
        const r1 = petaRezeki.score(ans);
        const r2 = petaRezeki.score(ans);
        expect(r1).toEqual(r2);
        expect(_internal.P[r1.profileId]).toBeDefined();
      }
    }
  });
  it('reaches all 12 profiles', () => {
    const seen = new Set<string>();
    // brute-force a sample of answer combinations
    const opts = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 4 ** 6; i++) {
      const ans: Answers = { ...base };
      let x = i;
      for (const q of ['q1','q2','q3','q4','q5','q6','q7','q8','q9','q10']) { ans[q] = opts[x % 4]; x = Math.floor(x / 4) || i % 4; }
      for (const risk of ['a', 'c']) seen.add(petaRezeki.score({ ...ans, m1: risk, m2: risk, m3: risk }).profileId);
    }
    expect(seen.size).toBe(12);
  });
  it('safe vs bold depends on risk answers', () => {
    expect(petaRezeki.score({ ...base, ...allOption('d') }).profileId.endsWith('safe')).toBe(true);
    expect(petaRezeki.score({ ...base, ...allOption('d'), m1: 'c', m2: 'c', m3: 'c' }).profileId.endsWith('bold')).toBe(true);
  });
  it('adds weton only for the weton variant', () => {
    const ans = { ...base, ...allOption('a'), birthdate: '1995-03-10' };
    expect(petaRezeki.score(ans).facts.weton).toBeUndefined();
    expect(petaRezeki.score(ans, 'weton').facts.weton).toBeTypeOf('string');
  });
  it('template report and preview are complete', () => {
    const ans = { ...base, ...allOption('b'), name: 'Dina' };
    const r = petaRezeki.score(ans);
    const pv = petaRezeki.preview(r, ans);
    expect(pv.insights).toHaveLength(3);
    const rep = petaRezeki.templateReport(r, ans);
    expect(rep.title).toContain('Dina');
    expect(rep.sections.length).toBeGreaterThanOrEqual(7);
  });
  it('primary path follows the situation', () => {
    expect(_internal.primaryPath({ status: 'owner' })).toBe('business');
    expect(_internal.primaryPath({ status: 'employee', hours: 'lt5', capital: '10to50' })).toBe('job');
    expect(_internal.primaryPath({ status: 'employee', hours: 'gt20', capital: '10to50' })).toBe('business');
    expect(_internal.primaryPath({ status: 'seeking', capital: 'lt1' })).toBe('job');
  });
});

describe('AI report parsing', () => {
  it('extracts JSON wrapped in prose', () => {
    const json = JSON.stringify({ title: 't', subtitle: 's', intro: 'i', closing: 'c', sections: [1, 2, 3].map((n) => ({ heading: `h${n}`, paragraphs: ['p'] })) });
    expect(parseReport('Berikut laporannya:\n' + json + '\nSelesai').sections).toHaveLength(3);
  });
  it('rejects thin reports', () => {
    expect(() => parseReport(JSON.stringify({ title: 't', subtitle: 's', intro: 'i', closing: 'c', sections: [] }))).toThrow();
  });
});

describe('mobile normalization', () => {
  it('converts Indonesian formats', () => {
    expect(normalizeMobile('0812-3456-7890')).toBe('6281234567890');
    expect(normalizeMobile('+62 812 3456 7890')).toBe('6281234567890');
    expect(normalizeMobile('81234567890')).toBe('6281234567890');
  });
});

describe('weton after maghrib', () => {
  it('moves to the next day when born after sunset', () => {
    expect(weton('1945-08-17', true)).toMatchObject({ label: 'Sabtu Pahing' });
  });
  it('peta rezeki uses the maghrib answer and notes the alternative when unknown', () => {
    const ans = { ...base, ...allOption('a'), birthdate: '1945-08-17' };
    expect(petaRezeki.score({ ...ans, maghrib: 'no' }, 'weton').facts.weton).toBe('Jumat Legi');
    expect(petaRezeki.score({ ...ans, maghrib: 'yes' }, 'weton').facts.weton).toBe('Sabtu Pahing');
    const unk = petaRezeki.score({ ...ans, maghrib: 'unknown' }, 'weton');
    expect(unk.facts.weton).toBe('Jumat Legi');
    expect(String(unk.facts.wetonIfAfterMaghrib)).toContain('Sabtu Pahing');
  });
});

import { midtransStatus, verifyMidtransSignature } from '../src/worker/payments';
import { createHash } from 'node:crypto';

describe('midtrans', () => {
  it('maps statuses', () => {
    expect(midtransStatus('settlement')).toBe('paid');
    expect(midtransStatus('capture', 'accept')).toBe('paid');
    expect(midtransStatus('capture', 'deny')).toBe('pending');
    expect(midtransStatus('pending')).toBe('pending');
    expect(midtransStatus('expire')).toBe('expired');
    expect(midtransStatus('cancel')).toBe('expired');
  });
  it('verifies notification signatures', async () => {
    const key = 'SB-Mid-server-test';
    const body = { order_id: 'abc123', status_code: '200', gross_amount: '99000.00' };
    const signature_key = createHash('sha512').update(body.order_id + body.status_code + body.gross_amount + key).digest('hex');
    expect(await verifyMidtransSignature({ ...body, signature_key }, key)).toBe(true);
    expect(await verifyMidtransSignature({ ...body, signature_key }, 'wrong-key')).toBe(false);
    expect(await verifyMidtransSignature({ ...body, gross_amount: '1.00', signature_key }, key)).toBe(false);
  });
});
