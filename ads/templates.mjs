// HTML templates for ad creatives. Rendered by ads/render.mjs with a headless browser.
// Sizes: feed 1080x1350 (4:5), story/reel 1080x1920 (9:16).
// Story/Reel safe zones: nothing important in the top ~15% (288px) or bottom ~35% (672px), or the right 120px.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function baseCss(theme, fonts) {
  return `
  ${fonts.map((f) => `@font-face{font-family:'Brand';font-weight:${f.weight};src:url(data:font/woff2;base64,${f.b64}) format('woff2');}`).join('\n')}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:100%;height:100%}
  body{font-family:'Brand',system-ui,sans-serif;background:${theme.bg};color:${theme.ink};-webkit-font-smoothing:antialiased;overflow:hidden}
  .brand{display:flex;align-items:center;gap:14px;font-weight:800;font-size:34px;letter-spacing:-.01em}
  .dot{width:18px;height:18px;border-radius:50%;background:${theme.accent}}
  .chip{display:inline-block;font-weight:700;font-size:26px;letter-spacing:.08em;text-transform:uppercase;color:${theme.accent};
        background:color-mix(in srgb,${theme.accent} 12%,#fff);padding:12px 20px;border-radius:999px}
  .headline{font-weight:800;letter-spacing:-.035em;line-height:1.04}
  .sub{font-weight:500;color:${theme.muted};line-height:1.35}
  .cta{display:inline-flex;align-items:center;gap:14px;background:${theme.accent};color:${theme.accentInk};font-weight:800;
       border-radius:22px;padding:28px 40px;font-size:36px}
  .phone{position:absolute;border-radius:64px;background:#111;padding:18px;box-shadow:0 40px 80px rgba(0,0,0,.25)}
  .phone img{display:block;width:100%;border-radius:48px}
  .blob{position:absolute;border-radius:50%;background:color-mix(in srgb,${theme.accent} 14%,${theme.bg})}
  `;
}

export function feedHtml({ theme, brand, hook, copy, endCta, shot, fonts }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss(theme, fonts)}
  body{width:1080px;height:1350px;position:relative}
  .wrap{position:absolute;left:80px;top:80px;width:600px}
  .headline{font-size:76px;margin:30px 0 26px}
  .sub{font-size:34px}
  .cta{position:absolute;left:80px;bottom:90px}
  .phone{width:420px;right:-30px;bottom:-140px;transform:rotate(-6deg)}
  .blob{width:620px;height:620px;right:-160px;bottom:-60px}
  </style></head><body>
  <div class="blob"></div>
  <div class="phone"><img src="data:image/png;base64,${shot}"></div>
  <div class="wrap">
    <div class="brand"><span class="dot"></span>${esc(brand)}</div>
    <div style="height:56px"></div>
    ${hook.eyebrow ? `<span class="chip">${esc(hook.eyebrow)}</span>` : ''}
    <div class="headline" style="font-size:${hook.headline.length > 60 ? 58 : hook.headline.length > 42 ? 66 : 76}px">${esc(hook.headline)}</div>
    <div class="sub">${esc(copy.video[2])}</div>
  </div>
  <div class="cta">${esc(endCta)} →</div>
  </body></html>`;
}

export function storyHtml(args) {
  // The static story is the Reel's final composition before the end card (t = 6.5s).
  return videoHtml(args).replace('</body>', '<script>render(6.5)</script></body>');
}

/** Story layout with a render(t) function that positions everything for time t (seconds). */
export function videoHtml({ theme, brand, hook, copy, endCta, shot, fonts }) {
  const words = copy.video[0].split(' ');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss(theme, fonts)}
  body{width:1080px;height:1920px;position:relative}
  .top{position:absolute;left:90px;top:300px;width:880px}
  .headline{font-size:92px;margin-top:34px}
  .headline span{display:inline-block;margin-right:.24em;will-change:transform,opacity}
  .l2{font-size:44px;margin-top:30px;font-weight:700;color:${theme.ink}}
  .phone{width:470px;left:305px;top:1000px}
  .blob{width:900px;height:900px;left:90px;top:860px}
  .end{position:absolute;inset:0;background:${theme.accent};color:${theme.accentInk};display:flex;flex-direction:column;
       align-items:flex-start;justify-content:center;padding:0 90px 520px;gap:36px}
  .end .brand{font-size:48px}
  .end .dot{background:${theme.accentInk}}
  .end .promise{font-weight:800;font-size:80px;letter-spacing:-.03em;line-height:1.08}
  .end .cta{background:${theme.accentInk};color:${theme.accent};font-size:44px;padding:32px 48px}
  .end .arrow{font-weight:700;font-size:36px;opacity:.9}
  </style></head><body>
  <div class="blob" id="blob"></div>
  <div class="phone" id="phone"><img src="data:image/png;base64,${shot}"></div>
  <div class="top" id="top">
    <div class="brand"><span class="dot"></span>${esc(brand)}</div>
    <div class="headline" id="hl">${words.map((w) => `<span>${esc(w)}</span>`).join('')}</div>
    <div class="sub l2" id="l2">${esc(copy.video[1])}</div>
  </div>
  <div class="end" id="end">
    <div class="brand"><span class="dot"></span>${esc(brand)}</div>
    <div class="promise">${esc(copy.video[2])}</div>
    <div class="cta">${esc(endCta)} →</div>
    <div class="arrow">Ketuk tombol di bawah ↓</div>
  </div>
  <script>
  const clamp=(x)=>Math.max(0,Math.min(1,x));
  const ease=(x)=>1-Math.pow(1-clamp(x),3);
  const words=[...document.querySelectorAll('#hl span')];
  window.render=function(t){
    // 0–2.5s: hook words pop in one by one
    words.forEach((w,i)=>{const p=ease((t-0.15-i*0.13)/0.35);w.style.opacity=p;w.style.transform='translateY('+(30*(1-p))+'px)';});
    // 2.6s: second line
    const p2=ease((t-2.6)/0.5); const l2=document.getElementById('l2'); l2.style.opacity=p2; l2.style.transform='translateY('+(24*(1-p2))+'px)';
    // 4.2s: phone with the real landing page slides up
    const pp=ease((t-4.2)/0.8); const ph=document.getElementById('phone'); ph.style.transform='translateY('+(700*(1-pp))+'px) rotate('+(-4*pp)+'deg)'; ph.style.opacity=pp;
    const blob=document.getElementById('blob'); blob.style.transform='scale('+(0.6+0.4*pp)+')'; blob.style.opacity=pp;
    // hook starts lower (centered) and moves up as the phone arrives
    document.getElementById('top').style.transform='translateY('+(300*(1-pp))+'px)';
    // 7.4s: end card wipes up with the promise and CTA
    const pe=ease((t-7.4)/0.55); const end=document.getElementById('end'); end.style.transform='translateY('+(100*(1-pe))+'%)';
  };
  render(0);
  </script>
  </body></html>`;
}

export function indexHtml(rows) {
  const byBet = {};
  for (const r of rows) (byBet[r.bet] ??= []).push(r);
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Ad creatives</title><style>
  body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#f6f6f4;color:#1b1b1b}
  h1{margin:0 0 8px}h2{margin:32px 0 12px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
  .card{background:#fff;border-radius:14px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .card img,.card video{width:100%;border-radius:8px;background:#ddd}
  .row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
  .meta{font-size:13px;line-height:1.45;margin-top:10px;white-space:pre-wrap}
  code{font-size:12px;word-break:break-all}
  </style></head><body>
  <h1>Ad creatives</h1><p>Feed (4:5), story (9:16) and Reel for each hook. Copy and tracked links are also in <code>ads.csv</code>.</p>
  ${Object.entries(byBet).map(([bet, items]) => `<h2>${esc(bet)}</h2><div class="grid">${items.map((r) => `
    <div class="card"><strong>Hook ${esc(r.hook)}</strong>
      <div class="row"><img src="${r.feed}"><img src="${r.story}">${r.reel ? `<video src="${r.reel}" controls muted loop playsinline></video>` : '<div></div>'}</div>
      <div class="meta"><b>Headline:</b> ${esc(r.headline)}\n<b>Text:</b> ${esc(r.primary)}\n<b>Audience:</b> ${esc(r.audience)}\n<b>Link:</b> <code>${esc(r.url)}</code></div>
    </div>`).join('')}</div>`).join('')}
  </body></html>`;
}
