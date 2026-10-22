import type { BetConfig, PublicBetConfig } from '../shared/types';

// Bets 2 and 3 run as waitlist landers for the hook test.
// When a bet passes its hook test, replace it with a full config (see peta-rezeki.ts) and set mode: 'live'.

type WaitlistFields = Omit<PublicBetConfig, 'mode' | 'questions' | 'price' | 'paywall' | 'analyzingLines'>;

function waitlistOnly(cfg: WaitlistFields): BetConfig {
  const notLive = () => { throw new Error(`${cfg.slug} is in waitlist mode`); };
  return {
    ...cfg,
    mode: 'waitlist',
    questions: [],
    price: 99000,
    paywall: { title: '', sub: '', includes: [], guarantee: '', button: '' },
    analyzingLines: [],
    score: notLive, preview: notLive, templateReport: notLive, reportPrompt: notLive,
  };
}

export const siapNikah = waitlistOnly({
  slug: 'siap-nikah',
  brand: 'Siap Nikah',
  theme: { bg: '#FBF5F2', surface: '#FFFFFF', ink: '#2B2130', muted: '#76687A', accent: '#9C3D54', accentInk: '#FFFFFF', font: 'Plus Jakarta Sans' },
  hooks: [
    { id: '1', eyebrow: 'Tes berdua, 10 menit', headline: 'Udah yakin sama dia. Tapi udah pernah bahas uang, anak, dan tinggal di mana?', sub: 'Kerjakan tes ini berdua. Kalian akan tahu di mana sejalan dan apa yang perlu diobrolin sebelum akad.', cta: 'Daftar akses awal' },
    { id: '2', eyebrow: 'Tes berdua, 10 menit', headline: 'Tahu di mana kalian sejalan, sebelum akad.', sub: 'Laporan kecocokan untuk calon pasangan: 8 area penting, plus pertanyaan yang perlu kalian bahas.', cta: 'Daftar akses awal' },
    { id: '3', eyebrow: 'Untuk yang sedang ta\'aruf', headline: 'Lagi ta\'aruf dan bingung mau nanya apa?', sub: 'Dapatkan daftar pertanyaan yang pas untuk kalian berdua, disusun dari jawaban kalian.', cta: 'Daftar akses awal' },
  ],
  landerBullets: ['Dikerjakan berdua, masing-masing di HP sendiri', 'Jawaban pribadi tidak saling dibuka', '8 area: keuangan, anak, keluarga besar, ibadah, dan lainnya'],
  trustLine: 'Panduan diskusi, bukan vonis. Untuk pertanyaan fiqih, tetap konsultasikan dengan ustadz/ustadzah.',
  waitlist: { title: 'Segera hadir', sub: 'Daftar untuk akses awal dan diskon peluncuran.', placeholder: 'Nomor WhatsApp atau email', button: 'Daftar akses awal', thanks: 'Terima kasih! Kami kabari begitu Siap Nikah dibuka.' },
  disclaimer: 'Laporan ini panduan diskusi, bukan penilaian layak atau tidaknya menikah.',
});

export const pilihJurusan = waitlistOnly({
  slug: 'pilih-jurusan',
  brand: 'Pilih Jurusan',
  theme: { bg: '#F3F6FB', surface: '#FFFFFF', ink: '#1A2333', muted: '#5F6B7E', accent: '#2457C5', accentInk: '#FFFFFF', font: 'Plus Jakarta Sans' },
  hooks: [
    { id: '1', eyebrow: 'Untuk orang tua siswa SMA', headline: 'Anak masih bingung mau kuliah jurusan apa?', sub: 'Salah jurusan bisa berarti pindah di semester 3. Tes 10 menit untuk menemukan 5 jurusan yang paling cocok.', cta: 'Daftar akses awal' },
    { id: '2', eyebrow: 'Untuk orang tua siswa SMA', headline: 'Ayah Bunda, kenali 3 tanda anak memilih jurusan karena ikut teman.', sub: 'Bantu anak memilih berdasarkan minat dan kekuatannya sendiri.', cta: 'Daftar akses awal' },
    { id: '3', eyebrow: 'Tes 10 menit', headline: '5 jurusan paling cocok untuk anak Anda, plus kampus dan prospek kerjanya.', sub: 'Laporan untuk didiskusikan bersama anak sebelum pendaftaran kuliah.', cta: 'Daftar akses awal' },
  ],
  landerBullets: ['Dikerjakan anak, dibaca bersama orang tua', 'Berbasis model minat karier Holland (RIASEC)', 'Termasuk panduan diskusi orang tua–anak'],
  trustLine: 'Data kampus akan selalu disertai sumber dan tanggal.',
  waitlist: { title: 'Segera hadir', sub: 'Daftar untuk akses awal dan diskon peluncuran.', placeholder: 'Nomor WhatsApp atau email', button: 'Daftar akses awal', thanks: 'Terima kasih! Kami kabari begitu Pilih Jurusan dibuka.' },
  disclaimer: 'Rekomendasi jurusan bersifat panduan. Selalu cek informasi resmi kampus.',
});
