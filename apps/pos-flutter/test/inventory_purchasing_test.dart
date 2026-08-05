import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parser pembelian mempertahankan status dan nilai server', () {
    final data = InventoryOperationsData.fromApi(
      const [],
      [
        {
          'id': 'ap1',
          'supplier_id': 's1',
          'supplier_name': 'PT Pemasok',
          'legacy_invoice_number': 'INV-1',
          'amount': '1250000',
          'aging_bucket': '31-60',
        }
      ],
      const [],
      [
        {
          'id': 'po1',
          'purchase_order_number': 'PO-1',
          'status': 'SENT',
          'order_date': '2026-08-06',
          'supplier_name': 'PT Pemasok',
          'grand_total': '2500000',
        }
      ],
      [
        {
          'payment_number': 'PAY-1',
          'payment_date': '2026-08-06',
          'supplier_name': 'PT Pemasok',
          'method': 'TRANSFER',
          'total_amount': '500000',
          'status': 'POSTED',
        }
      ],
      {
        'suppliers': [
          {'id': 's1', 'code': '001', 'name': 'PT Pemasok'}
        ]
      },
      {
        'products': [
          {
            'id': 'p1',
            'uom_id': 'u1',
            'code': 'P001',
            'name': 'Produk A',
            'price': '10000',
            'available_qty': '8',
          }
        ]
      },
      {
        'warehouses': [
          {'id': 'w1', 'code': 'GDG', 'name': 'Gudang Utama'}
        ]
      },
      Uri.parse('https://example.test/api/v1/'),
    );

    expect(data.payables.single.agingBucket, '31-60');
    expect(data.purchaseOrders.single.status, 'SENT');
    expect(data.apPayments.single.status, 'POSTED');
    expect(data.products.single.uomId, 'u1');
  });
}
