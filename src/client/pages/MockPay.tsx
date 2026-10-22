import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

/** Local testing only. In production the payment page is Mayar's. */
export function MockPay() {
  const { orderId } = useParams();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="page">
      <div className="brand"><span className="brand-dot" /> Simulasi pembayaran</div>
      <div className="center">
        <div className="card stack" style={{ width: '100%' }}>
          <h2>QRIS (simulasi)</h2>
          <p className="muted">Halaman ini hanya muncul saat PAYMENT_PROVIDER=mock. Di produksi, pembeli diarahkan ke halaman pembayaran Mayar.</p>
          <button className="btn" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              const r = await api<{ returnUrl: string }>(`/api/mock/pay/${orderId}`, {});
              nav(r.returnUrl, { replace: true });
            } catch (e) { setError((e as Error).message); setBusy(false); }
          }}>Bayar sekarang (simulasi)</button>
          {error && <div className="error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
