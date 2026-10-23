import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SITE } from '../../shared/site';

/** Small footer with legal links, used on every customer-facing page. */
export function LegalFooter() {
  return (
    <footer className="legal-footer no-print">
      <Link to="/privasi">Privasi</Link>
      <span>·</span>
      <Link to="/syarat">Syarat &amp; Ketentuan</Link>
      <span>·</span>
      <a href={`mailto:${SITE.contactEmail}`}>Kontak</a>
      <div className="small muted" style={{ marginTop: 6 }}>© {new Date().getFullYear()} {SITE.operator}</div>
    </footer>
  );
}

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  useEffect(() => { document.title = `${title} · ${SITE.operator}`; window.scrollTo(0, 0); }, [title]);
  return (
    <div className="page legal">
      <div className="brand"><span className="brand-dot" /> {SITE.operator}</div>
      <h1 style={{ fontSize: 32 }}>{title}</h1>
      <p className="small muted">Terakhir diperbarui: {SITE.legalUpdated}</p>
      {children}
      <LegalFooter />
    </div>
  );
}

const Mail = () => <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;

export function Privacy() {
  return (
    <LegalPage title="Kebijakan Privasi">
      <p>
        Kebijakan ini menjelaskan bagaimana {SITE.operator} (&quot;kami&quot;), pengelola layanan {SITE.brands.join(', ')}, mengumpulkan,
        memakai, dan melindungi data pribadimu, sesuai Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
      </p>

      <h2>Data yang kami kumpulkan</h2>
      <ul>
        <li><b>Jawaban tes</b> yang kamu isi, termasuk tanggal lahir jika kamu memilih mengisinya.</li>
        <li><b>Data kontak</b> saat membeli atau mendaftar: nama, email, dan nomor WhatsApp.</li>
        <li><b>Data transaksi</b>: jumlah, status, dan waktu pembayaran. Kami tidak menyimpan data kartu atau rekeningmu; pembayaran diproses oleh penyedia pembayaran.</li>
        <li><b>Data penggunaan</b>: halaman yang dibuka, langkah tes yang diselesaikan, perangkat dan peramban, serta sumber kunjungan (misalnya iklan yang kamu klik).</li>
      </ul>

      <h2>Untuk apa data dipakai</h2>
      <ul>
        <li>Menyusun hasil awal dan laporan personalmu.</li>
        <li>Memproses pembayaran dan mengirim akses laporan.</li>
        <li>Mengabari peluncuran layanan jika kamu mendaftar daftar tunggu.</li>
        <li>Memperbaiki layanan dan mengukur efektivitas iklan kami.</li>
      </ul>
      <p>Kami tidak menjual data pribadimu.</p>

      <h2>Pihak yang membantu kami</h2>
      <ul>
        <li><b>Cloudflare</b>: hosting situs dan penyimpanan data.</li>
        <li><b>Midtrans</b>: pemrosesan pembayaran.</li>
        <li><b>Penyedia AI</b> (melalui OpenRouter): jawaban tes dikirim untuk membantu menulis laporanmu. Nama panggilan boleh dikosongkan.</li>
        <li><b>Meta</b> (Facebook/Instagram): mengukur hasil iklan. Email dan nomor telepon hanya dikirim dalam bentuk tersandi (hash), tidak dalam bentuk asli.</li>
      </ul>
      <p>Sebagian penyedia ini dapat memproses data di luar Indonesia dengan perlindungan yang wajar.</p>

      <h2>Cookie dan pelacakan</h2>
      <p>
        Kami memakai penyimpanan di peramban dan Meta Pixel untuk mengingat langkah tesmu dan mengukur iklan. Kamu bisa
        memblokir atau menghapus cookie lewat pengaturan peramban; layanan tetap bisa dipakai.
      </p>

      <h2>Berapa lama data disimpan</h2>
      <p>
        Jawaban tes dan laporan disimpan agar kamu bisa membuka laporanmu lagi, paling lama 2 tahun, kecuali kamu meminta
        penghapusan lebih awal. Data transaksi disimpan sesuai kewajiban hukum.
      </p>

      <h2>Hak kamu</h2>
      <p>
        Kamu berhak meminta salinan, perbaikan, atau penghapusan data pribadimu, serta menarik persetujuan. Kirim permintaan ke <Mail /> dengan
        email atau nomor WhatsApp yang kamu pakai saat membeli. Kami akan merespons dalam 3×24 jam kerja.
      </p>

      <h2>Anak di bawah umur</h2>
      <p>
        Layanan kami ditujukan untuk usia 18 tahun ke atas. Tes untuk siswa (Pilih Jurusan) hanya boleh dikerjakan dengan
        persetujuan dan pendampingan orang tua atau wali.
      </p>

      <h2>Kontak</h2>
      <p>{SITE.operator} · <Mail /></p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Syarat & Ketentuan">
      <p>
        Dengan memakai layanan {SITE.brands.join(', ')} yang dikelola {SITE.operator}, kamu menyetujui syarat berikut.
      </p>

      <h2>1. Layanan</h2>
      <p>
        Kami menyediakan tes daring dan laporan digital personal untuk refleksi diri dan perencanaan. Laporan disusun dari
        jawabanmu dengan bantuan teknologi AI dan model yang kami rancang.
      </p>

      <h2>2. Bukan nasihat profesional atau jaminan</h2>
      <p>
        Hasil tes dan laporan <b>bukan</b> diagnosis psikologis, nasihat keuangan, hukum, agama, atau medis, dan <b>tidak menjamin</b> penghasilan,
        kecocokan, atau hasil tertentu. Bagian yang membahas weton atau primbon disajikan sebagai pengetahuan budaya, bukan ramalan.
        Keputusan yang kamu ambil tetap tanggung jawabmu.
      </p>

      <h2>3. Pembayaran</h2>
      <p>
        Laporan lengkap dibeli dengan sekali bayar, tanpa langganan, melalui Midtrans (QRIS, e-wallet, atau transfer bank).
        Harga tercantum di halaman pembayaran dalam Rupiah. Akses laporan diberikan segera setelah pembayaran terkonfirmasi.
      </p>

      <h2>4. Pengembalian dana</h2>
      <p>
        Tidak puas? Ajukan pengembalian dana dalam {SITE.refundDays} hari sejak pembelian dengan email ke <Mail />, sebutkan email atau
        nomor WhatsApp yang dipakai saat membeli. Dana dikembalikan ke metode pembayaran semula atau rekening yang kamu sebutkan,
        biasanya dalam 3–7 hari kerja.
      </p>

      <h2>5. Penggunaan yang wajar</h2>
      <p>
        Laporan untuk penggunaan pribadi. Kamu boleh membagikan kartu hasil ke media sosial, tetapi tidak boleh menjual ulang atau
        menyalin layanan kami. Jangan memakai layanan untuk tujuan yang melanggar hukum.
      </p>

      <h2>6. Usia</h2>
      <p>Layanan untuk usia 18 tahun ke atas, atau di bawah itu dengan persetujuan dan pendampingan orang tua atau wali.</p>

      <h2>7. Batas tanggung jawab</h2>
      <p>
        Sejauh diizinkan hukum, tanggung jawab kami atas layanan terbatas pada jumlah yang kamu bayarkan untuk laporan terkait.
      </p>

      <h2>8. Perubahan dan hukum yang berlaku</h2>
      <p>
        Kami dapat memperbarui syarat ini; versi terbaru selalu ada di halaman ini. Syarat ini tunduk pada hukum Republik Indonesia.
      </p>

      <h2>Kontak</h2>
      <p>{SITE.operator} · <Mail /></p>
    </LegalPage>
  );
}
