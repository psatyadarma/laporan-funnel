import type { Answers, BetConfig, QuizQuestion, ReportContent, ScoreResult } from '../shared/types';
import { normalized, sumPoints, topDimension, weton } from '../shared/scoring';

// Bet 1 — "Peta Rezeki": rezeki & career personality report.
// Framework: Holland RIASEC interests (R I A S E C) x money style (risk). 12 profiles.

const RIASEC = ['E', 'S', 'A', 'I', 'C', 'R']; // tie-break order (most commercially useful first)

const questions: QuizQuestion[] = [
  {
    id: 'status', kind: 'choice', prompt: 'Saat ini kamu…',
    options: [
      { id: 'student', label: 'Mahasiswa / pelajar' },
      { id: 'employee', label: 'Karyawan' },
      { id: 'freelance', label: 'Freelancer' },
      { id: 'owner', label: 'Punya usaha sendiri' },
      { id: 'seeking', label: 'Sedang cari kerja' },
    ],
  },
  {
    id: 'q1', kind: 'choice', prompt: 'Sabtu kosong seharian. Paling seru kalau kamu…',
    options: [
      { id: 'a', label: 'Benerin atau merakit sesuatu sendiri', points: { R: 2 } },
      { id: 'b', label: 'Baca atau nonton soal topik yang bikin penasaran', points: { I: 2 } },
      { id: 'c', label: 'Bikin konten, desain, atau masak resep baru', points: { A: 2 } },
      { id: 'd', label: 'Ketemu teman dan dengerin cerita mereka', points: { S: 2 } },
    ],
  },
  {
    id: 'q2', kind: 'choice', prompt: 'Di kerja kelompok, kamu biasanya jadi…',
    options: [
      { id: 'a', label: 'Yang mimpin dan presentasi', points: { E: 2 } },
      { id: 'b', label: 'Yang ngerapiin file, jadwal, dan catatan', points: { C: 2 } },
      { id: 'c', label: 'Yang nyari data dan ngecek faktanya', points: { I: 2 } },
      { id: 'd', label: 'Yang jaga suasana biar semua nyaman', points: { S: 2 } },
    ],
  },
  {
    id: 'q3', kind: 'choice', prompt: 'Pujian yang paling sering kamu dengar…',
    options: [
      { id: 'a', label: '"Kamu praktis banget, tanganmu cekatan"', points: { R: 2 } },
      { id: 'b', label: '"Idemu unik"', points: { A: 2 } },
      { id: 'c', label: '"Kamu jago ngeyakinin orang"', points: { E: 2 } },
      { id: 'd', label: '"Kamu teliti dan bisa diandalkan"', points: { C: 2 } },
    ],
  },
  {
    id: 'q4', kind: 'choice', prompt: 'Dapat Rp5 juta tak terduga. Kamu paling tergoda untuk…',
    options: [
      { id: 'a', label: 'Beli alat buat bikin atau benerin sesuatu', points: { R: 2 } },
      { id: 'b', label: 'Ikut kursus atau beli buku, belajar skill baru', points: { I: 2 } },
      { id: 'c', label: 'Jadi modal jualan kecil-kecilan', points: { E: 2 } },
      { id: 'd', label: 'Bantu keluarga atau orang yang butuh', points: { S: 2 } },
    ],
  },
  {
    id: 'q5', kind: 'choice', prompt: 'Tugas yang bikin kamu lupa waktu…',
    options: [
      { id: 'a', label: 'Memecahkan masalah rumit sampai ketemu jawabannya', points: { I: 2 } },
      { id: 'b', label: 'Merancang sesuatu yang indah atau beda', points: { A: 2 } },
      { id: 'c', label: 'Merapikan sistem yang berantakan jadi teratur', points: { C: 2 } },
      { id: 'd', label: 'Turun langsung ke lapangan, kerja pakai fisik', points: { R: 2 } },
    ],
  },
  {
    id: 'q6', kind: 'choice', prompt: 'Teman paling sering minta tolong kamu untuk…',
    options: [
      { id: 'a', label: 'Curhat dan minta saran', points: { S: 2 } },
      { id: 'b', label: 'Nyariin harga terbaik atau nego', points: { E: 2 } },
      { id: 'c', label: 'Bikinin caption, logo, atau dekorasi', points: { A: 2 } },
      { id: 'd', label: 'Ngitung, bikin tabel, atau urus dokumen', points: { C: 2 } },
    ],
  },
  {
    id: 'q7', kind: 'choice', prompt: 'Konten yang paling sering kamu tonton…',
    options: [
      { id: 'a', label: 'DIY, otomotif, renovasi, berkebun', points: { R: 2 } },
      { id: 'b', label: 'Sains, sejarah, teknologi, penjelasan mendalam', points: { I: 2 } },
      { id: 'c', label: 'Cerita orang, parenting, pengembangan diri', points: { S: 2 } },
      { id: 'd', label: 'Bisnis, jualan, kisah sukses', points: { E: 2 } },
    ],
  },
  {
    id: 'q8', kind: 'choice', prompt: 'Lingkungan kerja impianmu…',
    options: [
      { id: 'a', label: 'Bebas dan kreatif, sedikit aturan', points: { A: 2 } },
      { id: 'b', label: 'Aturannya jelas, rapi, terukur', points: { C: 2 } },
      { id: 'c', label: 'Banyak ketemu dan membantu orang', points: { S: 2 } },
      { id: 'd', label: 'Kompetitif, ada target dan bonus', points: { E: 2 } },
    ],
  },
  {
    id: 'q9', kind: 'choice', prompt: 'Ada yang rusak di rumah. Kamu…',
    options: [
      { id: 'a', label: 'Langsung ambil alat dan coba benerin', points: { R: 2 } },
      { id: 'b', label: 'Cari tahu dulu penyebabnya', points: { I: 2 } },
      { id: 'c', label: 'Bikin daftar langkah dan hitung biayanya', points: { C: 2 } },
      { id: 'd', label: 'Ajak ngobrol semua orang biar sepakat', points: { S: 2 } },
    ],
  },
  {
    id: 'q10', kind: 'choice', prompt: 'Momen yang paling bikin kamu bangga…',
    options: [
      { id: 'a', label: 'Karyaku dilihat dan disukai orang', points: { A: 2 } },
      { id: 'b', label: 'Berhasil closing atau menang negosiasi', points: { E: 2 } },
      { id: 'c', label: 'Barang buatanku benar-benar berfungsi', points: { R: 2 } },
      { id: 'd', label: 'Menemukan jawaban yang orang lain lewatkan', points: { I: 2 } },
    ],
  },
  {
    id: 'm1', kind: 'choice', prompt: 'Pilih satu penghasilan:',
    options: [
      { id: 'a', label: 'Gaji tetap Rp8 juta per bulan', points: { risk: 0 } },
      { id: 'b', label: 'Gaji tetap + sampingan yang naik-turun', points: { risk: 1 } },
      { id: 'c', label: 'Rp3–20 juta, tergantung usahaku sendiri', points: { risk: 2 } },
    ],
  },
  {
    id: 'm2', kind: 'choice', prompt: 'Usaha pertamamu rugi Rp2 juta. Kamu…',
    options: [
      { id: 'a', label: 'Berhenti dulu, cukup jadi pelajaran', points: { risk: 0 } },
      { id: 'b', label: 'Evaluasi, lalu coba lagi lebih hati-hati', points: { risk: 1 } },
      { id: 'c', label: 'Anggap biaya belajar, langsung coba lagi', points: { risk: 2 } },
    ],
  },
  {
    id: 'm3', kind: 'choice', prompt: 'Punya uang dingin Rp10 juta. Kamu taruh di…',
    options: [
      { id: 'a', label: 'Tabungan atau deposito', points: { risk: 0 } },
      { id: 'b', label: 'Emas atau reksa dana', points: { risk: 1 } },
      { id: 'c', label: 'Modal usaha atau saham pilihan', points: { risk: 2 } },
    ],
  },
  {
    id: 'm4', kind: 'choice', prompt: 'Cara kerja yang paling cocok untukmu…',
    options: [
      { id: 'a', label: 'Ada SOP dan arahan yang jelas', points: { structure: 2 } },
      { id: 'b', label: 'Ada target, caranya bebas', points: { structure: 1 } },
      { id: 'c', label: 'Bebas total, aku atur sendiri', points: { structure: 0 } },
    ],
  },
  {
    id: 'capital', kind: 'choice', prompt: 'Modal yang siap kamu pakai untuk mulai sesuatu?',
    options: [
      { id: 'lt1', label: 'Di bawah Rp1 juta' },
      { id: '1to10', label: 'Rp1–10 juta' },
      { id: '10to50', label: 'Rp10–50 juta' },
      { id: 'gt50', label: 'Di atas Rp50 juta' },
    ],
  },
  {
    id: 'hours', kind: 'choice', prompt: 'Waktu luang per minggu untuk mengejar rezeki tambahan?',
    options: [
      { id: 'lt5', label: 'Kurang dari 5 jam' },
      { id: '5to10', label: '5–10 jam' },
      { id: '10to20', label: '10–20 jam' },
      { id: 'gt20', label: 'Lebih dari 20 jam' },
    ],
  },
  {
    id: 'birthdate', kind: 'date', prompt: 'Tanggal lahirmu (untuk bagian weton)',
    help: 'Dipakai untuk menghitung weton menurut tradisi Jawa. Boleh dilewati.',
    optional: true, onlyForVariants: ['weton'],
  },
  {
    id: 'maghrib', kind: 'choice', prompt: 'Kamu lahir setelah maghrib?',
    help: 'Dalam tradisi Jawa, hari berganti saat matahari terbenam, jadi weton orang yang lahir setelah maghrib ikut hari berikutnya.',
    onlyForVariants: ['weton'],
    options: [
      { id: 'no', label: 'Tidak, sebelum maghrib' },
      { id: 'yes', label: 'Ya, setelah maghrib' },
      { id: 'unknown', label: 'Tidak tahu / lewati' },
    ],
  },
  {
    id: 'name', kind: 'text', prompt: 'Nama panggilanmu?', placeholder: 'mis. Dina',
    help: 'Supaya laporannya terasa untukmu.', optional: true,
  },
];

interface Profile {
  name: string;
  tagline: string;
  strengths: string[];
  blindSpots: string[];
  paths: { job: string[]; side: string[]; business: string[] };
  partner: string;
  habit: string;
}

const P: Record<string, Profile> = {
  'R-safe': {
    name: 'Pengrajin Andal', tagline: 'Kamu dihargai karena hasil kerjamu nyata dan bisa diandalkan.',
    strengths: ['Praktis: langsung tahu cara mengerjakan sesuatu', 'Tekun sampai hasilnya benar-benar jadi', 'Standar kualitasmu tinggi'],
    blindSpots: ['Jarang mempromosikan keahlian sendiri', 'Menganggap jualan "bukan gue"', 'Sering memasang harga terlalu murah'],
    paths: { job: ['Teknisi spesialis', 'Quality control', 'Juru masak profesional', 'Operator produksi senior'], side: ['Jasa servis/perbaikan panggilan', 'Produk kerajinan custom', 'Katering rumahan'], business: ['Bengkel atau servis spesialis', 'Produksi barang skala kecil', 'Jasa instalasi'] },
    partner: 'Negosiator Cerdas: orang yang senang jualan dan bernegosiasi, supaya kamu bisa fokus pada kualitas.',
    habit: 'Tulis daftar harga untuk keahlianmu dan naikkan pelan-pelan. Keahlian nyata layak dibayar pantas.',
  },
  'R-bold': {
    name: 'Pembangun Lapangan', tagline: 'Kamu paling hidup saat membangun sesuatu dari nol dengan tanganmu sendiri.',
    strengths: ['Eksekusi cepat', 'Berani turun langsung ke lapangan', 'Tahan banting saat ada masalah'],
    blindSpots: ['Semua dikerjakan sendiri', 'Administrasi dan catatan berantakan', 'Ekspansi sebelum sistemnya siap'],
    paths: { job: ['Supervisor atau mandor proyek', 'Field engineer', 'Koordinator operasional lapangan'], side: ['Jasa renovasi kecil', 'Jasa pindahan dan angkut', 'Budidaya ikan atau tanaman'], business: ['Kontraktor renovasi', 'Usaha produksi', 'Peternakan atau pertanian modern'] },
    partner: 'Penjaga Sistem: orang teliti yang mengurus keuangan dan administrasi.',
    habit: 'Pisahkan rekening usaha dan pribadi sejak proyek pertama.',
  },
  'I-safe': {
    name: 'Analis Tajam', tagline: 'Kamu dihargai karena melihat apa yang orang lain lewatkan.',
    strengths: ['Berpikir mendalam', 'Teliti membaca data', 'Cepat mempelajari hal baru'],
    blindSpots: ['Terlalu lama menganalisis sebelum mulai', 'Enggan "menjual diri"', 'Perfeksionis'],
    paths: { job: ['Data analyst', 'Peneliti atau analis riset', 'Programmer', 'Analis keuangan'], side: ['Jasa olah data atau riset untuk UMKM', 'Les privat mata pelajaran eksak', 'Menulis konten edukasi'], business: ['Konsultan spesialis', 'Produk digital (kursus, template)', 'Jasa analisis data'] },
    partner: 'Perintis Bisnis: orang berani yang mau menjual hasil pemikiranmu.',
    habit: 'Jangan tunggu "siap 100%". Jual versi pertama, lalu perbaiki.',
  },
  'I-bold': {
    name: 'Penemu Solusi', tagline: 'Kamu suka memecahkan masalah besar dan berani bertaruh pada idemu.',
    strengths: ['Inovatif', 'Berani bereksperimen', 'Logika kuat'],
    blindSpots: ['Pindah ke ide baru sebelum yang lama selesai', 'Meremehkan pemasaran', 'Cepat bosan dengan rutinitas'],
    paths: { job: ['Product atau tech role di startup', 'Engineer R&D', 'Growth analyst'], side: ['Bikin tools atau aplikasi kecil', 'Freelance teknis', 'Otomasi untuk UMKM'], business: ['Startup teknologi', 'Produk digital', 'Jasa otomasi bisnis'] },
    partner: 'Penjaga Sistem: orang yang memastikan ide-idemu selesai dan tercatat rapi.',
    habit: 'Tentukan batas "dana eksperimen" per bulan dan patuhi.',
  },
  'A-safe': {
    name: 'Kreator Konsisten', tagline: 'Rezekimu datang dari karya yang rutin dan berkualitas.',
    strengths: ['Rasa estetika kuat', 'Telaten dengan detail', 'Bisa membuat hal biasa jadi menarik'],
    blindSpots: ['Menghargai karya terlalu murah', 'Takut kritik', 'Menunggu mood'],
    paths: { job: ['Desainer grafis', 'Editor video', 'Content writer', 'Fotografer in-house'], side: ['Jasa desain atau edit freelance', 'Jual template atau preset', 'Foto produk untuk UMKM'], business: ['Studio desain kecil', 'Brand produk kreatif', 'Kelas kreatif online'] },
    partner: 'Negosiator Cerdas: orang yang mencarikan klien dan menegosiasikan harga.',
    habit: 'Punya daftar harga tertulis dan minta DP sebelum mulai.',
  },
  'A-bold': {
    name: 'Visioner Kreatif', tagline: 'Kamu dihargai karena berani tampil beda dan membangun audiens.',
    strengths: ['Ide orisinal', 'Berani tampil', 'Pandai bercerita'],
    blindSpots: ['Banyak proyek, sedikit yang selesai', 'Keuangan jarang dicatat', 'Terlalu berharap pada viral'],
    paths: { job: ['Creative lead', 'Content creator', 'Brand strategist'], side: ['Konten berbayar dan endorsement', 'Merchandise sendiri', 'Workshop kreatif'], business: ['Personal brand + produk', 'Agensi kreatif', 'Brand fashion atau lifestyle'] },
    partner: 'Penjaga Sistem: orang yang mengatur jadwal, kontrak, dan keuangan.',
    habit: 'Sisihkan 30% saat job sedang ramai. Pemasukan kreatif sering musiman.',
  },
  'S-safe': {
    name: 'Pendamping Tulus', tagline: 'Orang percaya padamu, dan kepercayaan itu bisa jadi rezeki.',
    strengths: ['Empati tinggi', 'Sabar', 'Mudah dipercaya'],
    blindSpots: ['Sungkan minta bayaran', 'Terlalu sering membantu gratis', 'Menghindari konflik'],
    paths: { job: ['Guru atau pengajar', 'HR', 'Customer success', 'Tenaga kesehatan'], side: ['Les privat', 'Asisten pribadi online', 'Pendampingan berbasis keahlianmu'], business: ['Bimbel atau daycare kecil', 'Jasa konsultasi', 'Komunitas berbayar'] },
    partner: 'Perintis Bisnis: orang yang nyaman bicara soal harga dan target.',
    habit: 'Tetapkan tarif yang jelas. Hindari "seikhlasnya".',
  },
  'S-bold': {
    name: 'Penggerak Komunitas', tagline: 'Kamu bisa mengumpulkan orang, dan di situ rezekimu berlipat.',
    strengths: ['Jaringan luas', 'Persuasif dengan hati', 'Bisa memimpin kelompok'],
    blindSpots: ['Terlalu banyak komitmen', 'Kurang fokus pada angka', 'Mudah percaya'],
    paths: { job: ['Community manager', 'Sales relasi', 'Event organizer', 'Trainer'], side: ['Agen atau reseller lewat jaringanmu', 'Acara komunitas berbayar', 'Kelas berbayar'], business: ['Komunitas berbayar', 'Event organizer', 'Bisnis berbasis jaringan yang legal dan jelas'] },
    partner: 'Analis Tajam: orang yang menghitung untung-rugi sebelum kamu melangkah.',
    habit: 'Hitung untung-rugi setiap acara atau proyek, sekecil apa pun.',
  },
  'E-safe': {
    name: 'Negosiator Cerdas', tagline: 'Kamu jago membaca orang dan menutup kesepakatan, tanpa harus nekat.',
    strengths: ['Komunikasi meyakinkan', 'Peka melihat peluang', 'Tenang saat negosiasi'],
    blindSpots: ['Cepat bosan dengan rutinitas', 'Kadang berjanji berlebihan', 'Mengabaikan detail'],
    paths: { job: ['Sales atau account manager', 'Procurement', 'Agen properti'], side: ['Makelar properti atau kendaraan', 'Reseller produk yang laku', 'Jasa pengadaan untuk kantor'], business: ['Distributor atau agen resmi', 'Jasa B2B', 'Toko dengan pemasok terpercaya'] },
    partner: 'Penjaga Sistem: orang yang mencatat komisi, stok, dan piutang.',
    habit: 'Catat setiap komisi dan piutang. Kesepakatan tanpa catatan mudah bocor.',
  },
  'E-bold': {
    name: 'Perintis Bisnis', tagline: 'Kamu paling hidup saat memimpin usaha dan mengejar target besar.',
    strengths: ['Berani mengambil keputusan', 'Visi besar', 'Bisa memotivasi orang'],
    blindSpots: ['Ekspansi terlalu cepat', 'Berutang demi gengsi', 'Kurang mendengar masukan'],
    paths: { job: ['Business development', 'Manajer cabang', 'Peran pendiri di startup'], side: ['Brand sendiri lewat dropship', 'Trading barang', 'Jualan live'], business: ['Brand sendiri', 'Franchise', 'Usaha multi-cabang'] },
    partner: 'Penjaga Sistem: orang yang berani bilang "angkanya belum masuk".',
    habit: 'Jangan pakai utang konsumtif untuk modal. Tumbuh dari keuntungan dulu.',
  },
  'C-safe': {
    name: 'Penjaga Sistem', tagline: 'Kamu membuat semuanya rapi dan aman, dan setiap bisnis butuh orang sepertimu.',
    strengths: ['Teliti', 'Konsisten', 'Dipercaya mengurus uang'],
    blindSpots: ['Ragu memulai usaha sendiri', 'Terlalu kaku', 'Kontribusimu jarang terlihat'],
    paths: { job: ['Akuntan atau finance', 'Admin dan operasional', 'Auditor', 'Konsultan pajak'], side: ['Jasa pembukuan UMKM', 'Virtual assistant', 'Jasa laporan pajak tahunan'], business: ['Kantor jasa pembukuan dan pajak', 'Toko dengan sistem stok rapi', 'Jasa administrasi'] },
    partner: 'Visioner Kreatif atau Perintis Bisnis: orang berani yang butuh kerapianmu.',
    habit: 'Kamu sudah rapi. Langkah berikutnya: alokasikan sebagian untuk investasi rutin.',
  },
  'C-bold': {
    name: 'Arsitek Proses', tagline: 'Kamu ahli membangun sistem yang membuat uang bekerja lebih efisien.',
    strengths: ['Berpikir sistematis', 'Efisien', 'Pandai mengelola risiko'],
    blindSpots: ['Terlalu lama menyempurnakan sistem', 'Kurang fleksibel', 'Sulit mendelegasikan'],
    paths: { job: ['Operations manager', 'Project manager', 'Supply chain'], side: ['Setup SOP dan sistem untuk UMKM', 'Template spreadsheet berbayar'], business: ['Jasa outsourcing operasional', 'Usaha berbasis SOP (laundry, gudang)', 'Franchise'] },
    partner: 'Penggerak Komunitas: orang yang membawa pelanggan ke sistem yang kamu bangun.',
    habit: 'Jangan bergantung pada satu sumber penghasilan. Bangun sumber kedua.',
  },
};

const LOCKED = [
  'Kekuatan & titik butamu',
  '3 jalur rezeki untuk situasimu',
  '10 pekerjaan & sampingan yang cocok',
  'Kebiasaan uang yang perlu dijaga',
  'Partner bisnis idealmu',
  'Rencana 90 hari',
];

function score(answers: Answers, variant?: string): ScoreResult {
  const { totals, max } = sumPoints(questions, answers);
  const norm = normalized(totals, max, [...RIASEC, 'risk', 'structure']);
  const top = topDimension(norm, RIASEC);
  const style = (totals.risk ?? 0) >= 4 ? 'bold' : 'safe';
  const facts: Record<string, string | number> = {};
  if (variant === 'weton' && answers.birthdate) {
    const w = weton(answers.birthdate, answers.maghrib === 'yes');
    if (w) { facts.weton = w.label; facts.neptu = w.neptu; }
    if (w && answers.maghrib === 'unknown') {
      const alt = weton(answers.birthdate, true);
      if (alt) facts.wetonIfAfterMaghrib = `${alt.label} (neptu ${alt.neptu})`;
    }
  }
  return { profileId: `${top}-${style}`, scores: norm, facts };
}

/** Which path to lead with, given the person's situation. */
function primaryPath(answers: Answers): 'job' | 'side' | 'business' {
  const lowCapital = answers.capital === 'lt1';
  const lowTime = answers.hours === 'lt5';
  if (answers.status === 'owner') return 'business';
  if (answers.status === 'seeking' || answers.status === 'student') return lowCapital ? 'job' : 'side';
  if (lowTime) return 'job';
  if (!lowCapital && (answers.hours === '10to20' || answers.hours === 'gt20')) return 'business';
  return 'side';
}

const PATH_LABEL = { job: 'Naik level di karier', side: 'Sampingan', business: 'Usaha sendiri' };
const STATUS_LABEL: Record<string, string> = { student: 'masih kuliah atau sekolah', employee: 'bekerja sebagai karyawan', freelance: 'bekerja sebagai freelancer', owner: 'sudah punya usaha sendiri', seeking: 'sedang mencari kerja' };
const CAPITAL_LABEL: Record<string, string> = { lt1: 'di bawah Rp1 juta', '1to10': 'Rp1–10 juta', '10to50': 'Rp10–50 juta', gt50: 'di atas Rp50 juta' };
const HOURS_LABEL: Record<string, string> = { lt5: 'kurang dari 5 jam', '5to10': '5–10 jam', '10to20': '10–20 jam', gt20: 'lebih dari 20 jam' };

function preview(r: ScoreResult, a: Answers) {
  const p = P[r.profileId];
  const lead = primaryPath(a);
  return {
    title: p.name,
    tagline: p.tagline,
    insights: p.strengths,
    teaser: `Jalur rezeki #1 untukmu: ${PATH_LABEL[lead]}: ${p.paths[lead][0]}`,
    lockedSections: r.facts.weton ? [...LOCKED, `Wetonmu (${r.facts.weton}) dalam tradisi Jawa`] : LOCKED,
    extra: r.facts.weton ? { weton: String(r.facts.weton) } : undefined,
  };
}

const DISCLAIMER = 'Laporan ini untuk refleksi diri dan perencanaan, bukan diagnosis psikologis atau jaminan penghasilan. Bagian weton disajikan sebagai pengetahuan budaya, bukan ramalan.';

function templateReport(r: ScoreResult, a: Answers): ReportContent {
  const p = P[r.profileId];
  const name = a.name?.trim() || 'Kamu';
  const lead = primaryPath(a);
  const order = [lead, ...(['job', 'side', 'business'] as const).filter((x) => x !== lead)];
  const sections: ReportContent['sections'] = [
    {
      heading: 'Profilmu',
      paragraphs: [
        `Profilmu adalah ${p.name}. ${p.tagline}`,
        `Saat ini kamu ${STATUS_LABEL[a.status] ?? 'sedang menata langkah'}, dengan modal ${CAPITAL_LABEL[a.capital] ?? 'terbatas'} dan waktu luang ${HOURS_LABEL[a.hours] ?? 'yang terbatas'} per minggu. Semua saran di bawah disesuaikan dengan kondisi itu.`,
      ],
    },
    { heading: 'Kekuatan utamamu', paragraphs: ['Ini modal yang paling sering membuka pintu rezeki untuk profilmu.'], bullets: p.strengths },
    { heading: 'Titik buta yang perlu dijaga', paragraphs: ['Bukan kelemahan permanen, hanya kebiasaan yang perlu diwaspadai.'], bullets: p.blindSpots },
    {
      heading: '3 jalur rezeki untuk situasimu',
      paragraphs: order.map((k, i) => `${i + 1}. ${PATH_LABEL[k]}: ${p.paths[k].slice(0, 2).join(' atau ')}.`),
    },
    { heading: 'Pekerjaan & sampingan yang cocok', paragraphs: [], bullets: [...p.paths.job, ...p.paths.side, ...p.paths.business].slice(0, 10) },
    { heading: 'Kebiasaan uang yang perlu dijaga', paragraphs: [p.habit] },
    { heading: 'Partner bisnis idealmu', paragraphs: [p.partner] },
    {
      heading: 'Rencana 90 hari',
      paragraphs: [
        `Bulan 1: pilih satu jalur dari "${PATH_LABEL[lead]}" dan riset 5 orang yang sudah sukses di sana.`,
        'Bulan 2: jalankan versi kecil. Targetkan pemasukan atau kemajuan pertama, sekecil apa pun.',
        'Bulan 3: evaluasi angkanya. Lanjutkan yang berhasil, hentikan yang tidak.',
      ],
    },
  ];
  if (r.facts.weton) {
    sections.push({
      heading: `Wetonmu dalam tradisi Jawa: ${r.facts.weton}`,
      paragraphs: [
        `Menurut perhitungan primbon, weton ${r.facts.weton} memiliki neptu ${r.facts.neptu}. Dalam tradisi Jawa, weton dipakai sebagai bahan renungan, bukan penentu nasib. Gunakan bagian ini sebagai cermin budaya, sementara langkah nyata tetap ada di rencana 90 hari di atas.`,
        ...(r.facts.wetonIfAfterMaghrib ? [`Catatan: jika kamu lahir setelah maghrib, wetonmu menurut tradisi menjadi ${r.facts.wetonIfAfterMaghrib}.`] : []),
      ],
    });
  }
  return {
    title: `${name}: ${p.name}`,
    subtitle: p.tagline,
    intro: `Berdasarkan jawabanmu, kecenderungan minat dan gaya uangmu paling dekat dengan profil ${p.name}.`,
    sections,
    closing: 'Rezeki bukan soal satu jalan yang benar, tapi soal jalan yang cocok denganmu. Mulai dari langkah kecil minggu ini.',
    disclaimer: DISCLAIMER,
    generatedBy: 'template',
  };
}

function reportPrompt(r: ScoreResult, a: Answers) {
  const p = P[r.profileId];
  const lead = primaryPath(a);
  const answered = questions
    .filter((q) => q.kind === 'choice')
    .map((q) => {
      const opt = q.kind === 'choice' ? q.options.find((o) => o.id === a[q.id]) : undefined;
      return opt ? `- ${q.prompt} → ${opt.label}` : null;
    })
    .filter(Boolean)
    .join('\n');
  const system = `Kamu penulis laporan pengembangan diri berbahasa Indonesia yang hangat, praktis, dan jujur.
Aturan:
- Tulis dalam Bahasa Indonesia santai-sopan (pakai "kamu").
- Jangan menjanjikan penghasilan, kekayaan, atau nasib. Jangan menyebut angka penghasilan pasti.
- Spesifik pada situasi orang ini (status, modal, waktu luang). Hindari kalimat umum yang cocok untuk semua orang.
- Jika ada data weton, tulis bagian weton sebagai pengetahuan budaya Jawa ("menurut tradisi primbon..."), bukan ramalan, dan kaitkan dengan refleksi diri.
- JANGAN menyebut skor, angka skor, huruf kode (R, I, A, S, E, C) atau istilah RIASEC di laporan. Terjemahkan jadi bahasa sehari-hari ("kamu paling bersemangat saat mencipta").
- Skenario di kuis (uang Rp5 juta tak terduga, rugi Rp2 juta, uang dingin Rp10 juta) adalah gambaran preferensi, bukan kejadian nyata. Jangan menulisnya seolah benar terjadi.
- Tanpa huruf tebal atau miring. Pakai hanya "## " untuk judul bagian dan "- " untuk poin.
- Tulis SEMUA bagian sampai "## Penutup". Lebih baik ringkas daripada terpotong.
- Ikuti FORMAT JAWABAN di bawah dengan tepat.`;
  const user = `Profil: ${p.name}: ${p.tagline}
Skor minat (0-1): ${JSON.stringify(r.scores)}
Kekuatan dasar: ${p.strengths.join('; ')}
Titik buta dasar: ${p.blindSpots.join('; ')}
Jalur dasar: karier ${p.paths.job.join(', ')} | sampingan ${p.paths.side.join(', ')} | usaha ${p.paths.business.join(', ')}
Jalur utama yang disarankan untuk situasinya: ${PATH_LABEL[lead]}
Partner ideal: ${p.partner}
Kebiasaan uang: ${p.habit}
${r.facts.weton ? `Weton: ${r.facts.weton}, neptu ${r.facts.neptu}${r.facts.wetonIfAfterMaghrib ? ` (jam lahir tidak diketahui; jika setelah maghrib: ${r.facts.wetonIfAfterMaghrib}. Sebutkan kemungkinan ini secara singkat.)` : ''}` : 'Weton: tidak ada'}
Nama panggilan: ${a.name?.trim() || '(tidak diisi)'}
Jawaban kuis:
${answered}

Tulis laporan 1.200–1.600 kata dengan bagian (heading) berurutan, lalu akhiri dengan "## Penutup":
1. Profilmu (siapa dia, dengan contoh dari jawabannya)
2. Kekuatan utamamu
3. Titik buta yang perlu dijaga
4. 3 jalur rezeki untuk situasimu (urutkan dari yang paling realistis untuk modal & waktunya, jelaskan langkah pertama tiap jalur)
5. 10 pekerjaan & sampingan yang cocok (bullets)
6. Kebiasaan uang yang perlu dijaga
7. Partner bisnis idealmu
8. Rencana 90 hari (per bulan, tindakan konkret)
${r.facts.weton ? '9. Wetonmu dalam tradisi Jawa' : ''}`;
  return { system, user };
}

/** Required body sections (excluding Penutup): 8, plus the weton section when present. */
function reportMinSections(r: ScoreResult) {
  return r.facts.weton ? 9 : 8;
}

export const petaRezeki: BetConfig = {
  slug: 'peta-rezeki',
  brand: 'Peta Rezeki',
  mode: 'live',
  theme: { bg: '#FBF7EF', surface: '#FFFFFF', ink: '#1F2A24', muted: '#6B7268', accent: '#1F6F50', accentInk: '#FFFFFF', font: 'Plus Jakarta Sans' },
  hooks: [
    { id: '1', eyebrow: 'Tes 5 menit', headline: 'Kerja keras tapi rezeki gitu-gitu aja?', sub: 'Bisa jadi kamu sedang mengejar jalur yang bukan untuk karaktermu. Temukan jalur rezeki yang paling cocok denganmu.', cta: 'Mulai tes gratis' },
    { id: '2', eyebrow: 'Tes 5 menit', headline: 'Kamu tipe yang cocok jualan, atau jadi spesialis?', sub: 'Kenali karakter rezekimu dan dapatkan langkah 90 hari yang sesuai modal dan waktumu.', cta: 'Cek tipeku' },
    {
      id: 'weton', eyebrow: 'Tes karakter rezeki + weton',
      headline: 'Wetonmu bilang apa soal jalur rezekimu?',
      sub: 'Tes karakter rezeki berbasis model konseling karier, dilengkapi bagian weton dari tradisi Jawa. Hasilnya: jalur rezeki yang cocok dan langkah 90 hari yang nyata.',
      cta: 'Mulai tes gratis',
      bullets: ['Tes karakter ±5 menit + tanggal lahir', 'Bonus: bagian weton & neptu menurut primbon Jawa', 'Fokus pada langkah nyata sesuai modal & waktumu'],
      trust: 'Bukan ramalan. Weton disajikan sebagai pengetahuan budaya Jawa, bukan penentu nasib.',
    },
  ],
  landerBullets: ['18 pertanyaan singkat, ±5 menit', 'Hasil awal langsung gratis', 'Laporan lengkap sesuai modal & waktumu'],
  trustLine: 'Berbasis model minat karier Holland (RIASEC) yang dipakai konselor karier.',
  waitlist: { title: 'Segera hadir', sub: 'Daftar untuk akses awal dan diskon peluncuran.', placeholder: 'Nomor WhatsApp atau email', button: 'Daftar akses awal', thanks: 'Terima kasih! Kami kabari begitu Peta Rezeki dibuka.' },
  questions,
  price: 99000,
  paywall: {
    title: 'Buka laporan lengkapmu',
    sub: 'Laporan personal lengkap, disusun dari jawaban dan situasimu.',
    includes: ['Kekuatan & titik buta profilmu', '3 jalur rezeki yang realistis untuk modal & waktumu', '10 pekerjaan dan sampingan yang cocok', 'Kebiasaan uang yang perlu dijaga', 'Tipe partner bisnis idealmu', 'Rencana aksi 90 hari'],
    guarantee: 'Sekali bayar, tanpa langganan. Tidak puas? Uang kembali dalam 7 hari.',
    button: 'Bayar Rp99.000 (QRIS / e-wallet)',
  },
  analyzingLines: ['Membaca pola minatmu…', 'Mencocokkan dengan 12 profil rezeki…', 'Menyesuaikan dengan modal & waktumu…'],
  disclaimer: DISCLAIMER,
  score, preview, templateReport, reportPrompt, reportMinSections,
};

export const _internal = { P, primaryPath };
