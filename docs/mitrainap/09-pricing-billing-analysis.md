# Analisis pricing dan billing

Belum ada keputusan harga. UI/API wajib memakai `PRICE_CONFIGURATION_REQUIRED` dan CTA **Minta Penawaran / Konsultasi**.

Metric yang boleh dikonfigurasi: `PROPERTY_MONTH`, `SELLABLE_UNIT_MONTH`, `ACTIVE_ROOM_MONTH`, `BED_MONTH`, `RESERVATION_MONTH`, `BOOKING_ENGINE_TRANSACTION`, `CHANNEL_CONNECTION_MONTH`, `POS_REGISTER_MONTH`, `MODULE_BUNDLE`, `CONTRACT_DEFINED`. Demo/sample/test/training/reversed usage tidak billable.

Reuse katalog harga/version, contract override, quote, subscription, usage, invoice, credit note, dan audit. Lima aliran uang tidak boleh dicampur: subscription platform, pembayaran reservasi tamu, pembayaran POS, piutang operasional tenant, settlement owner/investor. Keputusan pajak/fee/provider tetap configuration/contract, bukan konstanta controller.
