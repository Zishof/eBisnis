import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parser piutang mempertahankan status sales dan penerimaan', () {
    final data = InventoryOperationsData.fromApi(
      [
        {
          'id': 'ar1',
          'customer_id': 'c1',
          'customer_name': 'Toko Sejahtera',
          'salesperson_id': 'u1',
          'sales_name': 'Masrukin',
          'legacy_invoice_number': 'INV-1',
          'amount': '850000',
          'aging_bucket': '31-60',
          'is_settled': false,
        },
        {
          'id': 'ar2',
          'customer_id': 'c2',
          'customer_name': 'Apotek Makmur',
          'salesperson_id': 'u2',
          'sales_name': 'Tohirin',
          'legacy_invoice_number': 'INV-2',
          'amount': '0',
          'aging_bucket': 'LUNAS',
          'is_settled': true,
        }
      ],
      const [],
      const [],
      const [],
      const [],
      const {},
      const {},
      const {},
      Uri.parse('https://example.test/api/v1/'),
      [
        {
          'receipt_number': 'RCV-1',
          'receipt_date': '2026-08-06',
          'customer_name': 'Toko Sejahtera',
          'method': 'TRANSFER',
          'total_amount': '350000',
          'status': 'POSTED',
        }
      ],
    );

    expect(data.receivables.first.salesName, 'Masrukin');
    expect(data.receivables.last.isSettled, isTrue);
    expect(data.arReceipts.single.customerName, 'Toko Sejahtera');
    expect(data.arReceipts.single.total, 350000);
  });
}
