# UAT Decision Log

| ID | Area | Default aman | Status |
| --- | --- | --- | --- |
| UAT-01 | Sales membawa nota | Lifecycle `DRAFT -> HANDED_OVER -> RETURNED -> CLOSED`; tidak mengubah piutang tanpa receipt terpisah | UAT_REQUIRED |
| UAT-02 | Proses akhir periode legacy | Snapshot dan lock periode; tidak menghapus transaksi | UAT_REQUIRED |
| UAT-03 | Mapping akun sales 510/520/530 | Ditampilkan sebagai exception; tidak dibuat akun fiktif | UAT_REQUIRED |
| UAT-04 | Duplicate/orphan DBF | Dipertahankan di raw vault dan exception queue; tidak digabung otomatis | UAT_REQUIRED |
| UAT-05 | HPP Tambah (%) | Disimpan sebagai kebijakan eksplisit berversi, tidak menulis ulang HPP historis | UAT_REQUIRED |
| UAT-06 | Laporan piutang legacy | Pisahkan sales-by-product dari outstanding AR | UAT_REQUIRED |
