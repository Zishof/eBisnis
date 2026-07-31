-- AlterTable
ALTER TABLE "payment_order" ADD COLUMN     "marketplace_order_id" UUID,
ALTER COLUMN "invoice_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "payment_order_marketplace_order_id_status_idx" ON "payment_order"("marketplace_order_id", "status");

-- Tepat satu sumber tagihan.
--
-- `invoice_id` dilonggarkan menjadi opsional agar perintah bayar marketplace
-- dapat memakai tabel yang sama. Tanpa batasan ini, baris tanpa sumber sama
-- sekali dapat tersimpan — dan pertanyaan "ini tagihan apa" tidak akan punya
-- jawaban.
--
-- Ditulis sebagai CHECK, bukan sebagai pemeriksaan aplikasi, karena jalur
-- penulisan dapat bertambah dan yang baru bisa lupa memeriksanya.
ALTER TABLE "platform"."payment_order"
  ADD CONSTRAINT "ck_payment_order_source" CHECK (
    (invoice_id IS NOT NULL AND marketplace_order_id IS NULL)
    OR (invoice_id IS NULL AND marketplace_order_id IS NOT NULL)
  );
