import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parser stok harga dan opname mempertahankan identitas server', () {
    final data = InventoryStockPricingData.fromApi(
      {
        'products': [
          {
            'id': 'p1',
            'code': '001',
            'name': 'Produk A',
            'uom_code': 'BOX',
            'available_qty': '12',
            'price': '15000'
          }
        ]
      },
      [
        {
          'party_type': 'CUSTOMER',
          'party_name': 'Toko A',
          'product_code': '001',
          'product_name': 'Produk A',
          'effective_date': '2026-08-06',
          'price': '15500'
        }
      ],
      {
        'warehouses': [
          {'id': 'w1', 'code': 'GDG', 'name': 'Gudang'}
        ],
        'sessions': [
          {
            'id': 'o1',
            'opname_number': 'OPN-1',
            'status': 'COUNTED',
            'warehouse_name': 'Gudang',
            'line_count': 1,
            'counted_count': 1,
            'variance_value': '-500'
          }
        ]
      },
      [
        {
          'code': 'UMUM',
          'name': 'Harga Umum',
          'scope_type': 'TENANT',
          'approval_status': 'APPROVED',
          'item_count': 1
        }
      ],
      {
        'customers': [
          {'id': 'c1', 'code': 'C001', 'name': 'Toko A'}
        ],
        'suppliers': [
          {'id': 's1', 'code': 'S001', 'name': 'Supplier A'}
        ]
      },
    );
    expect(data.products.single.stock, 12);
    expect(data.prices.single.price, 15500);
    expect(data.opnames.single.status, 'COUNTED');
    expect(data.priceBooks.single.status, 'APPROVED');
    expect(data.customers.single.code, 'C001');
    expect(data.suppliers.single.code, 'S001');
  });

  test('parser baris opname menjaga batch dan jumlah fisik', () {
    final line = InventoryStockOpnameLine.fromApi({
      'id': 'line-1',
      'product_code': 'P001',
      'product_name': 'Produk A',
      'lot_number': 'LOT-9',
      'expiry_date': '2027-01-31',
      'system_qty': '12.5',
      'physical_qty': '11',
    });
    expect(line.lot, 'LOT-9');
    expect(line.systemQty, 12.5);
    expect(line.physicalQty, 11);
  });
}
