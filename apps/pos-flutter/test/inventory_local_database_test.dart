import 'package:drift/native.dart';
import 'package:ebisnis_pos/inventory/inventory_local_database.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late InventoryLocalDatabase database;

  setUp(() {
    database = InventoryLocalDatabase(NativeDatabase.memory());
  });

  tearDown(() => database.close());

  test('cache katalog bertahan sebagai sumber baca offline', () async {
    await database.putCache('mobile-catalog', {
      'customers': [
        {'id': 'c1', 'code': 'C001', 'name': 'Apotek Sehat'}
      ],
      'products': [
        {'id': 'p1', 'code': 'P001', 'name': 'Produk A'}
      ],
    });

    final cached = await database.getCache('mobile-catalog');

    expect((cached?['customers'] as List).length, 1);
    expect((cached?['products'] as List).length, 1);
  });

  test('outbox idempoten menyimpan command sampai selesai', () async {
    await database.enqueue(
      eventId: 'event-1',
      method: 'POST',
      path: '/inventory/mobile-orders',
      payload: {'deviceEventId': 'event-1'},
    );
    await database.enqueue(
      eventId: 'event-1',
      method: 'POST',
      path: '/inventory/mobile-orders',
      payload: {'deviceEventId': 'event-1'},
    );

    expect(await database.pendingCount(), 1);
    expect((await database.pendingOutbox()).single.attempts, 0);

    await database.markCompleted('event-1');

    expect(await database.pendingCount(), 0);
  });

  test('identitas perangkat dan cursor sinkronisasi bertahan lokal', () async {
    final first = await database.getOrCreateDeviceId();
    final second = await database.getOrCreateDeviceId();

    expect(second, first);
    expect(await database.lastPullCursor(first), 0);

    await database.recordSync(first, cursor: 42);

    expect(await database.lastPullCursor(first), 42);
  });
}
