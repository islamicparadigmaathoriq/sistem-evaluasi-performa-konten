# YTRank — Sistem Evaluasi Konten YouTube
> Tugas Akhir · Universitas Siber Asia  
> Metode: Simple Additive Weighting (SAW) + Rank Order Centroid (ROC)

---

## Struktur Proyek

```
/my-spk-youtube
├── index.html        ← Presentation Layer: Struktur HTML utama
├── style.css         ← Presentation Layer: Tampilan / Desain
├── app.js            ← Konduktor: Menghubungkan semua modul
└── /js
    ├── auth.js       ← Data Layer: Login Google OAuth 2.0
    ├── data.js       ← Data Layer: Ambil & cleaning data YouTube API
    ├── logic.js      ← Logic Layer: Perhitungan ROC & SAW
    └── ui.js         ← Presentation Layer: Render ke layar
```
