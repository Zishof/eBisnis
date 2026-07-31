/**
 * Bentuk data kasir sebagaimana dikirim peladen.
 *
 * Nama medannya mengikuti kolom basis data (`grand_total`, bukan `grandTotal`)
 * karena endpoint POS mengembalikan baris apa adanya. Menerjemahkannya di sini
 * akan menciptakan dua nama untuk satu hal, dan setiap penambahan kolom kelak
 * menuntut penerjemahan ulang yang mudah terlupa.
 */

export interface KonteksPos {
  outlets: Array<{ outletId: string; code: string; name: string; brandName: string | null }>;
  registers: Array<{
    terminalId: string;
    code: string;
    name: string;
    outletId: string;
    registerStatus: string;
    isPrimary: boolean;
  }>;
  openShift: {
    shiftId: string;
    terminalId: string;
    shiftNumber: string;
    openedAt: string;
    openingCash: string;
    businessDate: string;
  } | null;
  currency: string;
  timezone: string | null;
}

export interface BarisKeranjang {
  id: string;
  line_no: number;
  product_id: string;
  product_name: string;
  uom_id: string | null;
  quantity: string;
  unit_price: string;
  discount_amount: string;
  tax_amount: string;
  line_total: string;
  requires_approval: boolean;
  approved_by: string | null;
  returned_qty: string;
}

export interface KeranjangPos {
  id: string;
  status: string;
  outlet_id: string;
  terminal_id: string;
  shift_id: string;
  customer_id: string | null;
  business_date: string;
  currency_code: string | null;
  receipt_number: string | null;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  grand_total: string;
  paid_total: string;
  change_total: string;
  version: number;
  lines: BarisKeranjang[];
}

export interface ProdukPos {
  productId: string;
  code: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  uomId: string | null;
  price: string | null;
  currencyCode: string | null;
  availableQty: string | null;
}

export interface MetodePembayaran {
  id: string;
  code: string;
  name: string;
  methodType: string;
  requiresReference: boolean;
  allowsChange: boolean;
}
