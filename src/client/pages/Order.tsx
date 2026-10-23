import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, pixel, store, useBet } from '../api';
import { Brand } from './Lander';

interface OrderStatus { status: 'pending' | 'paid' | 'expired'; amount: number; eventId: string; payLink: string | null; reportToken: string | null; reportStatus: string | null }

export function Order() {
  const { bet: slug, orderId } = useParams();
  const { bet } = useBet(slug);
  const nav = useNavigate();
  const [o, setO] = useState<OrderStatus | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let stop = false;
    let n = 0;
    async function poll() {
      try {
        const r = await api<OrderStatus>(`/api/orders/${orderId}`);
        if (stop) return;
        setO(r);
        if (r.status === 'paid' && r.reportToken) {
          // Browser Purchase event (Meta) / CompletePayment (TikTok), deduplicated with the server-side events by event id.
          if (!store(`purchased:${orderId}`)) { pixel('Purchase', { currency: 'IDR', value: r.amount, content_name: slug }, r.eventId); store(`purchased:${orderId}`, '1'); }
          store(`report:${slug}`, r.reportToken);
          setTimeout(() => nav(`/r/${r.reportToken}`, { replace: true }), 900);
          return;
        }
        if (r.status === 'expired') return;
      } catch { /* keep polling */ }
      n += 1; setTries(n);
      if (n < 60 && !stop) setTimeout(poll, 3000);
    }
    poll();
    return () => { stop = true; };
  }, [orderId, slug, nav]);

  return (
    <div className="page">
      {bet && <Brand name={bet.brand} />}
      <div className="center">
        {!o || o.status === 'pending' ? (
          <>
            <div className="spinner" />
            <h2>Menunggu pembayaran</h2>
            <p className="muted">Halaman ini otomatis lanjut setelah pembayaranmu terkonfirmasi.</p>
            {o?.payLink && <a className="btn btn-ghost" href={o.payLink}>Buka halaman pembayaran lagi</a>}
            {tries >= 60 && <p className="small muted">Sudah bayar tapi belum lanjut? Muat ulang halaman ini dalam beberapa menit.</p>}
          </>
        ) : o.status === 'paid' ? (
          <>
            <div style={{ fontSize: 44 }}>✓</div>
            <h2>Pembayaran berhasil</h2>
            <p className="muted">Membuka laporanmu…</p>
          </>
        ) : (
          <>
            <h2>Pembayaran kedaluwarsa</h2>
            <p className="muted">Silakan kembali dan coba bayar lagi.</p>
            <button className="btn" onClick={() => history.back()}>Kembali</button>
          </>
        )}
      </div>
    </div>
  );
}
