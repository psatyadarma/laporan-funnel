// Ad copy per bet and hook. The renderer turns each entry into a feed image, a story image,
// a text-on-screen Reel, and a row in ads.csv (for Meta Ads Manager).
//
// Rules (Meta policy + honesty): no income or wealth promises, no "kaya" claims, no destiny claims,
// real app screens only, headline ≤ 40 characters, primary text ≈ 2–4 sentences.

export const CAMPAIGNS = {
  'peta-rezeki': {
    objective: 'Sales (website purchases)',
    audience: 'Indonesia, 22–40, broad (no interests); let Meta find buyers',
    ctaButton: 'LEARN_MORE',
    endCta: 'Mulai tes gratis',
    hooks: {
      '1': {
        video: ['Kerja keras tapi rezeki gitu-gitu aja?', 'Bisa jadi kamu ngejar jalur yang bukan buat karaktermu.', 'Tes 5 menit: temukan jalur rezeki yang cocok denganmu.'],
        primary: 'Udah kerja keras, tapi rasanya jalan di tempat? Kadang masalahnya bukan kurang usaha, tapi jalurnya belum cocok sama karaktermu. Tes 5 menit ini memetakan jalur rezeki yang paling pas dengan karakter, modal, dan waktumu. Hasil awal langsung gratis.',
        headline: 'Tes Karakter Rezeki, 5 Menit',
        description: 'Hasil awal gratis',
      },
      '2': {
        video: ['Kamu tipe yang cocok jualan…', '…atau lebih cocok jadi spesialis?', 'Cek tipe rezekimu dalam 5 menit.'],
        primary: 'Ada orang yang paling hidup saat closing, ada yang paling bersinar saat jadi ahli di satu bidang. Dua-duanya bisa berhasil, asal jalurnya cocok. Kenali tipe rezekimu dan dapatkan langkah 90 hari yang sesuai modal dan waktumu.',
        headline: 'Kamu Tipe Penjual atau Spesialis?',
        description: 'Tes 5 menit, hasil awal gratis',
      },
      weton: {
        video: ['Wetonmu bilang apa soal jalur rezekimu?', 'Tes karakter modern + bagian weton dari tradisi Jawa.', 'Bukan ramalan. Langkah nyata sesuai karaktermu.'],
        primary: 'Penasaran wetonmu dalam tradisi Jawa? Di Peta Rezeki, kamu ikut tes karakter rezeki berbasis model konseling karier, lengkap dengan bagian weton dan neptu menurut primbon. Bukan ramalan, tapi cermin budaya plus langkah nyata yang sesuai modal dan waktumu.',
        headline: 'Tes Karakter Rezeki + Weton',
        description: 'Bukan ramalan',
        audience: 'Jawa Tengah, Jawa Timur, DI Yogyakarta only, 22–40. Hide comments containing: syirik, musyrik, haram',
      },
    },
  },
  'siap-nikah': {
    objective: 'Leads (waitlist sign-ups) for the hook test',
    audience: 'Indonesia, 21–32, broad',
    ctaButton: 'SIGN_UP',
    endCta: 'Daftar akses awal',
    hooks: {
      '1': {
        video: ['Udah yakin sama dia?', 'Tapi udah pernah bahas uang, anak, dan tinggal di mana?', 'Tes berdua 10 menit. Daftar akses awal.'],
        primary: 'Persiapan nikah biasanya soal gedung, undangan, dan baju. Tapi obrolan soal uang, anak, keluarga besar, dan tinggal di mana sering terlewat. Siap Nikah adalah tes berdua 10 menit yang menunjukkan di mana kalian sejalan dan apa yang perlu dibahas sebelum akad. Daftar sekarang untuk akses awal.',
        headline: 'Tes Kecocokan Sebelum Akad',
        description: 'Segera hadir',
      },
      '2': {
        video: ['Tahu di mana kalian sejalan…', '…sebelum akad.', '8 area penting, dikerjakan berdua.'],
        primary: 'Dua orang baik belum tentu punya arah yang sama. Siap Nikah membantu kalian melihat 8 area penting, dari keuangan, anak, keluarga besar, sampai ibadah, lalu memberi daftar obrolan yang perlu dibahas berdua. Jawaban pribadi tidak saling dibuka.',
        headline: '8 Area yang Wajib Dibahas Berdua',
        description: 'Segera hadir',
      },
      '3': {
        video: ['Lagi ta’aruf…', '…dan bingung mau nanya apa?', 'Dapatkan daftar pertanyaan yang pas untuk kalian.'],
        primary: 'Proses ta’aruf itu singkat, tapi pertanyaannya menentukan banyak hal. Siap Nikah menyusun daftar pertanyaan yang pas untuk kalian berdua, dari visi keluarga sampai keuangan. Panduan diskusi, bukan vonis. Daftar untuk akses awal.',
        headline: 'Bingung Mau Nanya Apa Saat Ta’aruf?',
        description: 'Segera hadir',
      },
    },
  },
  'pilih-jurusan': {
    objective: 'Leads (waitlist sign-ups) for the hook test',
    audience: 'Indonesia, parents 38–55 (no targeting of under-18s), broad',
    ctaButton: 'SIGN_UP',
    endCta: 'Daftar akses awal',
    hooks: {
      '1': {
        video: ['Anak masih bingung mau kuliah jurusan apa?', 'Salah jurusan bisa berarti pindah di semester 3.', 'Tes 10 menit: 5 jurusan paling cocok.'],
        primary: 'Ayah Bunda, memilih jurusan sering jadi keputusan yang terburu-buru. Pilih Jurusan adalah tes 10 menit untuk anak SMA yang menunjukkan 5 jurusan paling cocok dengan minat dan kekuatannya, lengkap dengan prospek kerja dan panduan diskusi orang tua dan anak. Daftar untuk akses awal.',
        headline: '5 Jurusan Paling Cocok untuk Anak',
        description: 'Segera hadir',
      },
      '2': {
        video: ['Ayah Bunda, kenali 3 tanda…', '…anak memilih jurusan karena ikut teman.', 'Bantu anak memilih sesuai minatnya sendiri.'],
        primary: 'Ikut teman, ikut tren, atau ikut keinginan orang tua: tiga alasan yang sering membuat anak salah jurusan. Pilih Jurusan membantu anak memilih berdasarkan minat dan kekuatannya sendiri, dengan laporan yang bisa didiskusikan bersama. Daftar untuk akses awal.',
        headline: 'Bantu Anak Pilih Jurusan yang Tepat',
        description: 'Segera hadir',
      },
      '3': {
        video: ['5 jurusan paling cocok untuk anak Anda…', '…plus kampus dan prospek kerjanya.', 'Tes 10 menit untuk siswa SMA.'],
        primary: 'Sebelum mendaftar kuliah, pastikan pilihan jurusan anak berdasarkan minat dan kekuatannya, bukan tebakan. Pilih Jurusan memberi 5 rekomendasi jurusan beserta kampus dan prospek kerjanya, untuk didiskusikan bersama anak. Daftar untuk akses awal.',
        headline: 'Tes Jurusan 10 Menit untuk Anak SMA',
        description: 'Segera hadir',
      },
    },
  },
};
