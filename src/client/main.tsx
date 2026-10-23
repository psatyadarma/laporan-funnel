import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import './styles.css';
import { Lander } from './pages/Lander';
import { Quiz } from './pages/Quiz';
import { Preview } from './pages/Preview';
import { Order } from './pages/Order';
import { Report } from './pages/Report';
import { MockPay } from './pages/MockPay';
import { Admin } from './pages/Admin';
import { Privacy, Terms } from './pages/Legal';

function Home() {
  return (
    <div className="page">
      <div className="brand"><span className="brand-dot" /> Laporan funnels</div>
      <h1>Bets</h1>
      <div className="stack">
        <Link className="btn" to="/peta-rezeki">Peta Rezeki</Link>
        <Link className="btn btn-ghost" to="/siap-nikah">Siap Nikah (waitlist)</Link>
        <Link className="btn btn-ghost" to="/pilih-jurusan">Pilih Jurusan (waitlist)</Link>
        <Link className="link-btn" to="/admin">Admin stats</Link>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/privasi" element={<Privacy />} />
        <Route path="/syarat" element={<Terms />} />
        <Route path="/mock-pay/:orderId" element={<MockPay />} />
        <Route path="/r/:token" element={<Report />} />
        <Route path="/:bet" element={<Lander />} />
        <Route path="/:bet/quiz" element={<Quiz />} />
        <Route path="/:bet/hasil/:sessionId" element={<Preview />} />
        <Route path="/:bet/order/:orderId" element={<Order />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
