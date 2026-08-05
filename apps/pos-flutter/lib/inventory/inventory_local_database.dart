import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'inventory_local_database.g.dart';

class InventoryCacheEntries extends Table {
  TextColumn get cacheKey => text()();
  TextColumn get payload => text()();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();
  IntColumn get serverCursor => integer().withDefault(const Constant(0))();

  @override
  Set<Column<Object>> get primaryKey => {cacheKey};
}

class InventoryOutboxItems extends Table {
  TextColumn get eventId => text()();
  TextColumn get method => text()();
  TextColumn get path => text()();
  TextColumn get payload => text()();
  TextColumn get status => text().withDefault(const Constant('PENDING'))();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get nextAttemptAt =>
      dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get completedAt => dateTime().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {eventId};
}

class InventorySyncStates extends Table {
  TextColumn get deviceId => text()();
  IntColumn get lastPullCursor => integer().withDefault(const Constant(0))();
  DateTimeColumn get lastSyncAt => dateTime().nullable()();
  TextColumn get lastError => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {deviceId};
}

@DriftDatabase(
    tables: [InventoryCacheEntries, InventoryOutboxItems, InventorySyncStates])
class InventoryLocalDatabase extends _$InventoryLocalDatabase {
  InventoryLocalDatabase([QueryExecutor? executor])
      : super(executor ?? _openConnection());

  static InventoryLocalDatabase? _shared;

  factory InventoryLocalDatabase.shared() =>
      _shared ??= InventoryLocalDatabase();

  @override
  int get schemaVersion => 1;

  static QueryExecutor _openConnection() => LazyDatabase(() async {
        final directory = await getApplicationSupportDirectory();
        final file =
            File(p.join(directory.path, 'ebisnis_inventory_sales.sqlite'));
        return NativeDatabase.createInBackground(file);
      });

  Future<void> putCache(String key, Object value, {int cursor = 0}) async {
    await into(inventoryCacheEntries).insertOnConflictUpdate(
      InventoryCacheEntriesCompanion.insert(
        cacheKey: key,
        payload: jsonEncode(value),
        cachedAt: Value(DateTime.now().toUtc()),
        serverCursor: Value(cursor),
      ),
    );
  }

  Future<Map<String, Object?>?> getCache(String key) async {
    final row = await (select(inventoryCacheEntries)
          ..where((table) => table.cacheKey.equals(key)))
        .getSingleOrNull();
    if (row == null) return null;
    return jsonDecode(row.payload) as Map<String, Object?>;
  }

  Future<void> enqueue({
    required String eventId,
    required String method,
    required String path,
    required Map<String, Object?> payload,
  }) async {
    await into(inventoryOutboxItems).insertOnConflictUpdate(
      InventoryOutboxItemsCompanion.insert(
        eventId: eventId,
        method: method,
        path: path,
        payload: jsonEncode(payload),
        status: const Value('PENDING'),
        nextAttemptAt: Value(DateTime.now().toUtc()),
      ),
    );
  }

  Future<List<InventoryOutboxItem>> pendingOutbox({int limit = 100}) {
    final now = DateTime.now().toUtc();
    return (select(inventoryOutboxItems)
          ..where((table) =>
              table.status.isIn(['PENDING', 'FAILED']) &
              table.nextAttemptAt.isSmallerOrEqualValue(now))
          ..orderBy([(table) => OrderingTerm.asc(table.createdAt)])
          ..limit(limit))
        .get();
  }

  Future<void> markCompleted(String eventId) async {
    await (update(inventoryOutboxItems)
          ..where((table) => table.eventId.equals(eventId)))
        .write(
      InventoryOutboxItemsCompanion(
        status: const Value('COMPLETED'),
        completedAt: Value(DateTime.now().toUtc()),
        lastError: const Value(null),
      ),
    );
  }

  Future<void> markFailed(InventoryOutboxItem item, Object error) async {
    final attempts = item.attempts + 1;
    final delayMinutes = attempts >= 6 ? 60 : 1 << attempts.clamp(0, 5);
    await (update(inventoryOutboxItems)
          ..where((table) => table.eventId.equals(item.eventId)))
        .write(
      InventoryOutboxItemsCompanion(
        status: const Value('FAILED'),
        attempts: Value(attempts),
        lastError: Value(error.toString()),
        nextAttemptAt:
            Value(DateTime.now().toUtc().add(Duration(minutes: delayMinutes))),
      ),
    );
  }

  Future<int> pendingCount() async {
    final count = inventoryOutboxItems.eventId.count();
    final query = selectOnly(inventoryOutboxItems)
      ..addColumns([count])
      ..where(inventoryOutboxItems.status.isIn(['PENDING', 'FAILED']));
    return (await query.map((row) => row.read(count) ?? 0).getSingle());
  }

  Future<String> getOrCreateDeviceId() async {
    final existing = await (select(inventorySyncStates)..limit(1)).getSingleOrNull();
    if (existing != null) return existing.deviceId;
    final deviceId = 'inventory-${DateTime.now().microsecondsSinceEpoch}-$pid';
    await into(inventorySyncStates).insert(
      InventorySyncStatesCompanion.insert(deviceId: deviceId),
    );
    return deviceId;
  }

  Future<int> lastPullCursor(String deviceId) async {
    final state = await (select(inventorySyncStates)
          ..where((table) => table.deviceId.equals(deviceId)))
        .getSingleOrNull();
    return state?.lastPullCursor ?? 0;
  }

  Future<void> recordSync(
    String deviceId, {
    required int cursor,
    String? error,
  }) async {
    await into(inventorySyncStates).insertOnConflictUpdate(
      InventorySyncStatesCompanion.insert(
        deviceId: deviceId,
        lastPullCursor: Value(cursor),
        lastSyncAt: Value(DateTime.now().toUtc()),
        lastError: Value(error),
      ),
    );
  }
}
