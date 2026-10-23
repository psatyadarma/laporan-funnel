// Fake outside services for end-to-end tests: an OpenAI-compatible AI API, the Resend email API and TikTok's Events API.
// Control the AI with POST /__mode {"mode": "ok" | "truncated" | "noclosing" | "error" | "slow"} and read GET /__calls.
// Emails and TikTok events are recorded: GET /__outbox, cleared by POST /__mode.
import http from 'node:http';

const PORT = Number(process.env.FAKE_AI_PORT ?? 8790);
let mode = 'ok';
let calls = 0;
let outbox = { emails: [], tiktok: [] };

const SECTIONS = ['Profilmu', 'Kekuatan utamamu', 'Titik buta yang perlu dijaga', '3 jalur rezeki untuk situasimu',
  '10 pekerjaan & sampingan yang cocok', 'Kebiasaan uang yang perlu dijaga', 'Partner bisnis idealmu', 'Rencana 90 hari', 'Wetonmu dalam tradisi Jawa'];

function reportText({ closing = true, cut = false } = {}) {
  const parts = SECTIONS.map((h, i) =>
    `## ${h}\nIni paragraf AI untuk bagian "${h}" dengan apostrof Jum'at dan *kata miring* serta **tebal**.\n- Poin pertama bagian ${i + 1}\n- Poin kedua\n\nParagraf lanjutan setelah poin.`);
  let text = `JUDUL: Dimas: Kreator Konsisten (AI)\nSUBJUDUL: Laporan uji dari AI palsu.\nPEMBUKA: Pembuka dari AI palsu, dengan "kutipan".\n\n${parts.join('\n\n')}`;
  if (cut) text = text.slice(0, Math.floor(text.length * 0.6));
  if (closing && !cut) text += '\n\n## Penutup\nPenutup dari AI palsu.';
  return text;
}

const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };

http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', () => {
    if (req.url === '/__mode' && req.method === 'POST') { mode = JSON.parse(body || '{}').mode ?? 'ok'; calls = 0; outbox = { emails: [], tiktok: [] }; return send(res, 200, { mode }); }
    if (req.url === '/__calls') return send(res, 200, { calls, mode });
    if (req.url === '/__outbox') return send(res, 200, outbox);
    if (req.url === '/emails' && req.method === 'POST') {
      outbox.emails.push({ auth: req.headers.authorization, idempotencyKey: req.headers['idempotency-key'], ...JSON.parse(body) });
      return send(res, 200, { id: `email_${outbox.emails.length}` });
    }
    if (req.url === '/open_api/v1.3/event/track/' && req.method === 'POST') {
      outbox.tiktok.push({ token: req.headers['access-token'], ...JSON.parse(body) });
      return send(res, 200, { code: 0, message: 'OK' });
    }
    if (req.url?.endsWith('/chat/completions')) {
      calls++;
      const reply = (content, finish_reason = 'stop') => send(res, 200, { choices: [{ message: { content }, finish_reason }] });
      if (mode === 'error') return send(res, 529, { error: 'overloaded' });
      if (mode === 'truncated') return reply(reportText({ cut: true }), 'length');
      if (mode === 'noclosing') return reply(reportText({ closing: false }));
      if (mode === 'slow') return setTimeout(() => reply(reportText()), 15000);
      return reply(reportText());
    }
    send(res, 404, { error: 'not found' });
  });
}).listen(PORT, () => console.log(`fake AI on ${PORT}`));
