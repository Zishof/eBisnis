// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'inventory_local_database.dart';

// ignore_for_file: type=lint
class $InventoryCacheEntriesTable extends InventoryCacheEntries
    with TableInfo<$InventoryCacheEntriesTable, InventoryCacheEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $InventoryCacheEntriesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _cacheKeyMeta =
      const VerificationMeta('cacheKey');
  @override
  late final GeneratedColumn<String> cacheKey = GeneratedColumn<String>(
      'cache_key', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _payloadMeta =
      const VerificationMeta('payload');
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
      'payload', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  static const VerificationMeta _serverCursorMeta =
      const VerificationMeta('serverCursor');
  @override
  late final GeneratedColumn<int> serverCursor = GeneratedColumn<int>(
      'server_cursor', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  @override
  List<GeneratedColumn> get $columns =>
      [cacheKey, payload, cachedAt, serverCursor];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'inventory_cache_entries';
  @override
  VerificationContext validateIntegrity(
      Insertable<InventoryCacheEntry> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('cache_key')) {
      context.handle(_cacheKeyMeta,
          cacheKey.isAcceptableOrUnknown(data['cache_key']!, _cacheKeyMeta));
    } else if (isInserting) {
      context.missing(_cacheKeyMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(_payloadMeta,
          payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta));
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    if (data.containsKey('server_cursor')) {
      context.handle(
          _serverCursorMeta,
          serverCursor.isAcceptableOrUnknown(
              data['server_cursor']!, _serverCursorMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {cacheKey};
  @override
  InventoryCacheEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return InventoryCacheEntry(
      cacheKey: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}cache_key'])!,
      payload: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payload'])!,
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}cached_at'])!,
      serverCursor: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}server_cursor'])!,
    );
  }

  @override
  $InventoryCacheEntriesTable createAlias(String alias) {
    return $InventoryCacheEntriesTable(attachedDatabase, alias);
  }
}

class InventoryCacheEntry extends DataClass
    implements Insertable<InventoryCacheEntry> {
  final String cacheKey;
  final String payload;
  final DateTime cachedAt;
  final int serverCursor;
  const InventoryCacheEntry(
      {required this.cacheKey,
      required this.payload,
      required this.cachedAt,
      required this.serverCursor});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['cache_key'] = Variable<String>(cacheKey);
    map['payload'] = Variable<String>(payload);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    map['server_cursor'] = Variable<int>(serverCursor);
    return map;
  }

  InventoryCacheEntriesCompanion toCompanion(bool nullToAbsent) {
    return InventoryCacheEntriesCompanion(
      cacheKey: Value(cacheKey),
      payload: Value(payload),
      cachedAt: Value(cachedAt),
      serverCursor: Value(serverCursor),
    );
  }

  factory InventoryCacheEntry.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return InventoryCacheEntry(
      cacheKey: serializer.fromJson<String>(json['cacheKey']),
      payload: serializer.fromJson<String>(json['payload']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
      serverCursor: serializer.fromJson<int>(json['serverCursor']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'cacheKey': serializer.toJson<String>(cacheKey),
      'payload': serializer.toJson<String>(payload),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
      'serverCursor': serializer.toJson<int>(serverCursor),
    };
  }

  InventoryCacheEntry copyWith(
          {String? cacheKey,
          String? payload,
          DateTime? cachedAt,
          int? serverCursor}) =>
      InventoryCacheEntry(
        cacheKey: cacheKey ?? this.cacheKey,
        payload: payload ?? this.payload,
        cachedAt: cachedAt ?? this.cachedAt,
        serverCursor: serverCursor ?? this.serverCursor,
      );
  InventoryCacheEntry copyWithCompanion(InventoryCacheEntriesCompanion data) {
    return InventoryCacheEntry(
      cacheKey: data.cacheKey.present ? data.cacheKey.value : this.cacheKey,
      payload: data.payload.present ? data.payload.value : this.payload,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
      serverCursor: data.serverCursor.present
          ? data.serverCursor.value
          : this.serverCursor,
    );
  }

  @override
  String toString() {
    return (StringBuffer('InventoryCacheEntry(')
          ..write('cacheKey: $cacheKey, ')
          ..write('payload: $payload, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('serverCursor: $serverCursor')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(cacheKey, payload, cachedAt, serverCursor);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is InventoryCacheEntry &&
          other.cacheKey == this.cacheKey &&
          other.payload == this.payload &&
          other.cachedAt == this.cachedAt &&
          other.serverCursor == this.serverCursor);
}

class InventoryCacheEntriesCompanion
    extends UpdateCompanion<InventoryCacheEntry> {
  final Value<String> cacheKey;
  final Value<String> payload;
  final Value<DateTime> cachedAt;
  final Value<int> serverCursor;
  final Value<int> rowid;
  const InventoryCacheEntriesCompanion({
    this.cacheKey = const Value.absent(),
    this.payload = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.serverCursor = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  InventoryCacheEntriesCompanion.insert({
    required String cacheKey,
    required String payload,
    this.cachedAt = const Value.absent(),
    this.serverCursor = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : cacheKey = Value(cacheKey),
        payload = Value(payload);
  static Insertable<InventoryCacheEntry> custom({
    Expression<String>? cacheKey,
    Expression<String>? payload,
    Expression<DateTime>? cachedAt,
    Expression<int>? serverCursor,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (cacheKey != null) 'cache_key': cacheKey,
      if (payload != null) 'payload': payload,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (serverCursor != null) 'server_cursor': serverCursor,
      if (rowid != null) 'rowid': rowid,
    });
  }

  InventoryCacheEntriesCompanion copyWith(
      {Value<String>? cacheKey,
      Value<String>? payload,
      Value<DateTime>? cachedAt,
      Value<int>? serverCursor,
      Value<int>? rowid}) {
    return InventoryCacheEntriesCompanion(
      cacheKey: cacheKey ?? this.cacheKey,
      payload: payload ?? this.payload,
      cachedAt: cachedAt ?? this.cachedAt,
      serverCursor: serverCursor ?? this.serverCursor,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (cacheKey.present) {
      map['cache_key'] = Variable<String>(cacheKey.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (serverCursor.present) {
      map['server_cursor'] = Variable<int>(serverCursor.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('InventoryCacheEntriesCompanion(')
          ..write('cacheKey: $cacheKey, ')
          ..write('payload: $payload, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('serverCursor: $serverCursor, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $InventoryOutboxItemsTable extends InventoryOutboxItems
    with TableInfo<$InventoryOutboxItemsTable, InventoryOutboxItem> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $InventoryOutboxItemsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _eventIdMeta =
      const VerificationMeta('eventId');
  @override
  late final GeneratedColumn<String> eventId = GeneratedColumn<String>(
      'event_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _methodMeta = const VerificationMeta('method');
  @override
  late final GeneratedColumn<String> method = GeneratedColumn<String>(
      'method', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _pathMeta = const VerificationMeta('path');
  @override
  late final GeneratedColumn<String> path = GeneratedColumn<String>(
      'path', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _payloadMeta =
      const VerificationMeta('payload');
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
      'payload', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('PENDING'));
  static const VerificationMeta _attemptsMeta =
      const VerificationMeta('attempts');
  @override
  late final GeneratedColumn<int> attempts = GeneratedColumn<int>(
      'attempts', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _lastErrorMeta =
      const VerificationMeta('lastError');
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
      'last_error', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  static const VerificationMeta _nextAttemptAtMeta =
      const VerificationMeta('nextAttemptAt');
  @override
  late final GeneratedColumn<DateTime> nextAttemptAt =
      GeneratedColumn<DateTime>('next_attempt_at', aliasedName, false,
          type: DriftSqlType.dateTime,
          requiredDuringInsert: false,
          defaultValue: currentDateAndTime);
  static const VerificationMeta _completedAtMeta =
      const VerificationMeta('completedAt');
  @override
  late final GeneratedColumn<DateTime> completedAt = GeneratedColumn<DateTime>(
      'completed_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  @override
  List<GeneratedColumn> get $columns => [
        eventId,
        method,
        path,
        payload,
        status,
        attempts,
        lastError,
        createdAt,
        nextAttemptAt,
        completedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'inventory_outbox_items';
  @override
  VerificationContext validateIntegrity(
      Insertable<InventoryOutboxItem> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('event_id')) {
      context.handle(_eventIdMeta,
          eventId.isAcceptableOrUnknown(data['event_id']!, _eventIdMeta));
    } else if (isInserting) {
      context.missing(_eventIdMeta);
    }
    if (data.containsKey('method')) {
      context.handle(_methodMeta,
          method.isAcceptableOrUnknown(data['method']!, _methodMeta));
    } else if (isInserting) {
      context.missing(_methodMeta);
    }
    if (data.containsKey('path')) {
      context.handle(
          _pathMeta, path.isAcceptableOrUnknown(data['path']!, _pathMeta));
    } else if (isInserting) {
      context.missing(_pathMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(_payloadMeta,
          payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta));
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('attempts')) {
      context.handle(_attemptsMeta,
          attempts.isAcceptableOrUnknown(data['attempts']!, _attemptsMeta));
    }
    if (data.containsKey('last_error')) {
      context.handle(_lastErrorMeta,
          lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    }
    if (data.containsKey('next_attempt_at')) {
      context.handle(
          _nextAttemptAtMeta,
          nextAttemptAt.isAcceptableOrUnknown(
              data['next_attempt_at']!, _nextAttemptAtMeta));
    }
    if (data.containsKey('completed_at')) {
      context.handle(
          _completedAtMeta,
          completedAt.isAcceptableOrUnknown(
              data['completed_at']!, _completedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {eventId};
  @override
  InventoryOutboxItem map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return InventoryOutboxItem(
      eventId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}event_id'])!,
      method: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}method'])!,
      path: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}path'])!,
      payload: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payload'])!,
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      attempts: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}attempts'])!,
      lastError: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}last_error']),
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      nextAttemptAt: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime, data['${effectivePrefix}next_attempt_at'])!,
      completedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}completed_at']),
    );
  }

  @override
  $InventoryOutboxItemsTable createAlias(String alias) {
    return $InventoryOutboxItemsTable(attachedDatabase, alias);
  }
}

class InventoryOutboxItem extends DataClass
    implements Insertable<InventoryOutboxItem> {
  final String eventId;
  final String method;
  final String path;
  final String payload;
  final String status;
  final int attempts;
  final String? lastError;
  final DateTime createdAt;
  final DateTime nextAttemptAt;
  final DateTime? completedAt;
  const InventoryOutboxItem(
      {required this.eventId,
      required this.method,
      required this.path,
      required this.payload,
      required this.status,
      required this.attempts,
      this.lastError,
      required this.createdAt,
      required this.nextAttemptAt,
      this.completedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['event_id'] = Variable<String>(eventId);
    map['method'] = Variable<String>(method);
    map['path'] = Variable<String>(path);
    map['payload'] = Variable<String>(payload);
    map['status'] = Variable<String>(status);
    map['attempts'] = Variable<int>(attempts);
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    map['next_attempt_at'] = Variable<DateTime>(nextAttemptAt);
    if (!nullToAbsent || completedAt != null) {
      map['completed_at'] = Variable<DateTime>(completedAt);
    }
    return map;
  }

  InventoryOutboxItemsCompanion toCompanion(bool nullToAbsent) {
    return InventoryOutboxItemsCompanion(
      eventId: Value(eventId),
      method: Value(method),
      path: Value(path),
      payload: Value(payload),
      status: Value(status),
      attempts: Value(attempts),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
      createdAt: Value(createdAt),
      nextAttemptAt: Value(nextAttemptAt),
      completedAt: completedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(completedAt),
    );
  }

  factory InventoryOutboxItem.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return InventoryOutboxItem(
      eventId: serializer.fromJson<String>(json['eventId']),
      method: serializer.fromJson<String>(json['method']),
      path: serializer.fromJson<String>(json['path']),
      payload: serializer.fromJson<String>(json['payload']),
      status: serializer.fromJson<String>(json['status']),
      attempts: serializer.fromJson<int>(json['attempts']),
      lastError: serializer.fromJson<String?>(json['lastError']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      nextAttemptAt: serializer.fromJson<DateTime>(json['nextAttemptAt']),
      completedAt: serializer.fromJson<DateTime?>(json['completedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'eventId': serializer.toJson<String>(eventId),
      'method': serializer.toJson<String>(method),
      'path': serializer.toJson<String>(path),
      'payload': serializer.toJson<String>(payload),
      'status': serializer.toJson<String>(status),
      'attempts': serializer.toJson<int>(attempts),
      'lastError': serializer.toJson<String?>(lastError),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'nextAttemptAt': serializer.toJson<DateTime>(nextAttemptAt),
      'completedAt': serializer.toJson<DateTime?>(completedAt),
    };
  }

  InventoryOutboxItem copyWith(
          {String? eventId,
          String? method,
          String? path,
          String? payload,
          String? status,
          int? attempts,
          Value<String?> lastError = const Value.absent(),
          DateTime? createdAt,
          DateTime? nextAttemptAt,
          Value<DateTime?> completedAt = const Value.absent()}) =>
      InventoryOutboxItem(
        eventId: eventId ?? this.eventId,
        method: method ?? this.method,
        path: path ?? this.path,
        payload: payload ?? this.payload,
        status: status ?? this.status,
        attempts: attempts ?? this.attempts,
        lastError: lastError.present ? lastError.value : this.lastError,
        createdAt: createdAt ?? this.createdAt,
        nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
        completedAt: completedAt.present ? completedAt.value : this.completedAt,
      );
  InventoryOutboxItem copyWithCompanion(InventoryOutboxItemsCompanion data) {
    return InventoryOutboxItem(
      eventId: data.eventId.present ? data.eventId.value : this.eventId,
      method: data.method.present ? data.method.value : this.method,
      path: data.path.present ? data.path.value : this.path,
      payload: data.payload.present ? data.payload.value : this.payload,
      status: data.status.present ? data.status.value : this.status,
      attempts: data.attempts.present ? data.attempts.value : this.attempts,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      nextAttemptAt: data.nextAttemptAt.present
          ? data.nextAttemptAt.value
          : this.nextAttemptAt,
      completedAt:
          data.completedAt.present ? data.completedAt.value : this.completedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('InventoryOutboxItem(')
          ..write('eventId: $eventId, ')
          ..write('method: $method, ')
          ..write('path: $path, ')
          ..write('payload: $payload, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('lastError: $lastError, ')
          ..write('createdAt: $createdAt, ')
          ..write('nextAttemptAt: $nextAttemptAt, ')
          ..write('completedAt: $completedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(eventId, method, path, payload, status,
      attempts, lastError, createdAt, nextAttemptAt, completedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is InventoryOutboxItem &&
          other.eventId == this.eventId &&
          other.method == this.method &&
          other.path == this.path &&
          other.payload == this.payload &&
          other.status == this.status &&
          other.attempts == this.attempts &&
          other.lastError == this.lastError &&
          other.createdAt == this.createdAt &&
          other.nextAttemptAt == this.nextAttemptAt &&
          other.completedAt == this.completedAt);
}

class InventoryOutboxItemsCompanion
    extends UpdateCompanion<InventoryOutboxItem> {
  final Value<String> eventId;
  final Value<String> method;
  final Value<String> path;
  final Value<String> payload;
  final Value<String> status;
  final Value<int> attempts;
  final Value<String?> lastError;
  final Value<DateTime> createdAt;
  final Value<DateTime> nextAttemptAt;
  final Value<DateTime?> completedAt;
  final Value<int> rowid;
  const InventoryOutboxItemsCompanion({
    this.eventId = const Value.absent(),
    this.method = const Value.absent(),
    this.path = const Value.absent(),
    this.payload = const Value.absent(),
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    this.lastError = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
    this.completedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  InventoryOutboxItemsCompanion.insert({
    required String eventId,
    required String method,
    required String path,
    required String payload,
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    this.lastError = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
    this.completedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : eventId = Value(eventId),
        method = Value(method),
        path = Value(path),
        payload = Value(payload);
  static Insertable<InventoryOutboxItem> custom({
    Expression<String>? eventId,
    Expression<String>? method,
    Expression<String>? path,
    Expression<String>? payload,
    Expression<String>? status,
    Expression<int>? attempts,
    Expression<String>? lastError,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? nextAttemptAt,
    Expression<DateTime>? completedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (eventId != null) 'event_id': eventId,
      if (method != null) 'method': method,
      if (path != null) 'path': path,
      if (payload != null) 'payload': payload,
      if (status != null) 'status': status,
      if (attempts != null) 'attempts': attempts,
      if (lastError != null) 'last_error': lastError,
      if (createdAt != null) 'created_at': createdAt,
      if (nextAttemptAt != null) 'next_attempt_at': nextAttemptAt,
      if (completedAt != null) 'completed_at': completedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  InventoryOutboxItemsCompanion copyWith(
      {Value<String>? eventId,
      Value<String>? method,
      Value<String>? path,
      Value<String>? payload,
      Value<String>? status,
      Value<int>? attempts,
      Value<String?>? lastError,
      Value<DateTime>? createdAt,
      Value<DateTime>? nextAttemptAt,
      Value<DateTime?>? completedAt,
      Value<int>? rowid}) {
    return InventoryOutboxItemsCompanion(
      eventId: eventId ?? this.eventId,
      method: method ?? this.method,
      path: path ?? this.path,
      payload: payload ?? this.payload,
      status: status ?? this.status,
      attempts: attempts ?? this.attempts,
      lastError: lastError ?? this.lastError,
      createdAt: createdAt ?? this.createdAt,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
      completedAt: completedAt ?? this.completedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (eventId.present) {
      map['event_id'] = Variable<String>(eventId.value);
    }
    if (method.present) {
      map['method'] = Variable<String>(method.value);
    }
    if (path.present) {
      map['path'] = Variable<String>(path.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (attempts.present) {
      map['attempts'] = Variable<int>(attempts.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (nextAttemptAt.present) {
      map['next_attempt_at'] = Variable<DateTime>(nextAttemptAt.value);
    }
    if (completedAt.present) {
      map['completed_at'] = Variable<DateTime>(completedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('InventoryOutboxItemsCompanion(')
          ..write('eventId: $eventId, ')
          ..write('method: $method, ')
          ..write('path: $path, ')
          ..write('payload: $payload, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('lastError: $lastError, ')
          ..write('createdAt: $createdAt, ')
          ..write('nextAttemptAt: $nextAttemptAt, ')
          ..write('completedAt: $completedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $InventorySyncStatesTable extends InventorySyncStates
    with TableInfo<$InventorySyncStatesTable, InventorySyncState> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $InventorySyncStatesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _deviceIdMeta =
      const VerificationMeta('deviceId');
  @override
  late final GeneratedColumn<String> deviceId = GeneratedColumn<String>(
      'device_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _lastPullCursorMeta =
      const VerificationMeta('lastPullCursor');
  @override
  late final GeneratedColumn<int> lastPullCursor = GeneratedColumn<int>(
      'last_pull_cursor', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  static const VerificationMeta _lastSyncAtMeta =
      const VerificationMeta('lastSyncAt');
  @override
  late final GeneratedColumn<DateTime> lastSyncAt = GeneratedColumn<DateTime>(
      'last_sync_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _lastErrorMeta =
      const VerificationMeta('lastError');
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
      'last_error', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  @override
  List<GeneratedColumn> get $columns =>
      [deviceId, lastPullCursor, lastSyncAt, lastError];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'inventory_sync_states';
  @override
  VerificationContext validateIntegrity(Insertable<InventorySyncState> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('device_id')) {
      context.handle(_deviceIdMeta,
          deviceId.isAcceptableOrUnknown(data['device_id']!, _deviceIdMeta));
    } else if (isInserting) {
      context.missing(_deviceIdMeta);
    }
    if (data.containsKey('last_pull_cursor')) {
      context.handle(
          _lastPullCursorMeta,
          lastPullCursor.isAcceptableOrUnknown(
              data['last_pull_cursor']!, _lastPullCursorMeta));
    }
    if (data.containsKey('last_sync_at')) {
      context.handle(
          _lastSyncAtMeta,
          lastSyncAt.isAcceptableOrUnknown(
              data['last_sync_at']!, _lastSyncAtMeta));
    }
    if (data.containsKey('last_error')) {
      context.handle(_lastErrorMeta,
          lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {deviceId};
  @override
  InventorySyncState map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return InventorySyncState(
      deviceId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}device_id'])!,
      lastPullCursor: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}last_pull_cursor'])!,
      lastSyncAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}last_sync_at']),
      lastError: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}last_error']),
    );
  }

  @override
  $InventorySyncStatesTable createAlias(String alias) {
    return $InventorySyncStatesTable(attachedDatabase, alias);
  }
}

class InventorySyncState extends DataClass
    implements Insertable<InventorySyncState> {
  final String deviceId;
  final int lastPullCursor;
  final DateTime? lastSyncAt;
  final String? lastError;
  const InventorySyncState(
      {required this.deviceId,
      required this.lastPullCursor,
      this.lastSyncAt,
      this.lastError});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['device_id'] = Variable<String>(deviceId);
    map['last_pull_cursor'] = Variable<int>(lastPullCursor);
    if (!nullToAbsent || lastSyncAt != null) {
      map['last_sync_at'] = Variable<DateTime>(lastSyncAt);
    }
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    return map;
  }

  InventorySyncStatesCompanion toCompanion(bool nullToAbsent) {
    return InventorySyncStatesCompanion(
      deviceId: Value(deviceId),
      lastPullCursor: Value(lastPullCursor),
      lastSyncAt: lastSyncAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastSyncAt),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
    );
  }

  factory InventorySyncState.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return InventorySyncState(
      deviceId: serializer.fromJson<String>(json['deviceId']),
      lastPullCursor: serializer.fromJson<int>(json['lastPullCursor']),
      lastSyncAt: serializer.fromJson<DateTime?>(json['lastSyncAt']),
      lastError: serializer.fromJson<String?>(json['lastError']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'deviceId': serializer.toJson<String>(deviceId),
      'lastPullCursor': serializer.toJson<int>(lastPullCursor),
      'lastSyncAt': serializer.toJson<DateTime?>(lastSyncAt),
      'lastError': serializer.toJson<String?>(lastError),
    };
  }

  InventorySyncState copyWith(
          {String? deviceId,
          int? lastPullCursor,
          Value<DateTime?> lastSyncAt = const Value.absent(),
          Value<String?> lastError = const Value.absent()}) =>
      InventorySyncState(
        deviceId: deviceId ?? this.deviceId,
        lastPullCursor: lastPullCursor ?? this.lastPullCursor,
        lastSyncAt: lastSyncAt.present ? lastSyncAt.value : this.lastSyncAt,
        lastError: lastError.present ? lastError.value : this.lastError,
      );
  InventorySyncState copyWithCompanion(InventorySyncStatesCompanion data) {
    return InventorySyncState(
      deviceId: data.deviceId.present ? data.deviceId.value : this.deviceId,
      lastPullCursor: data.lastPullCursor.present
          ? data.lastPullCursor.value
          : this.lastPullCursor,
      lastSyncAt:
          data.lastSyncAt.present ? data.lastSyncAt.value : this.lastSyncAt,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
    );
  }

  @override
  String toString() {
    return (StringBuffer('InventorySyncState(')
          ..write('deviceId: $deviceId, ')
          ..write('lastPullCursor: $lastPullCursor, ')
          ..write('lastSyncAt: $lastSyncAt, ')
          ..write('lastError: $lastError')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(deviceId, lastPullCursor, lastSyncAt, lastError);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is InventorySyncState &&
          other.deviceId == this.deviceId &&
          other.lastPullCursor == this.lastPullCursor &&
          other.lastSyncAt == this.lastSyncAt &&
          other.lastError == this.lastError);
}

class InventorySyncStatesCompanion extends UpdateCompanion<InventorySyncState> {
  final Value<String> deviceId;
  final Value<int> lastPullCursor;
  final Value<DateTime?> lastSyncAt;
  final Value<String?> lastError;
  final Value<int> rowid;
  const InventorySyncStatesCompanion({
    this.deviceId = const Value.absent(),
    this.lastPullCursor = const Value.absent(),
    this.lastSyncAt = const Value.absent(),
    this.lastError = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  InventorySyncStatesCompanion.insert({
    required String deviceId,
    this.lastPullCursor = const Value.absent(),
    this.lastSyncAt = const Value.absent(),
    this.lastError = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : deviceId = Value(deviceId);
  static Insertable<InventorySyncState> custom({
    Expression<String>? deviceId,
    Expression<int>? lastPullCursor,
    Expression<DateTime>? lastSyncAt,
    Expression<String>? lastError,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (deviceId != null) 'device_id': deviceId,
      if (lastPullCursor != null) 'last_pull_cursor': lastPullCursor,
      if (lastSyncAt != null) 'last_sync_at': lastSyncAt,
      if (lastError != null) 'last_error': lastError,
      if (rowid != null) 'rowid': rowid,
    });
  }

  InventorySyncStatesCompanion copyWith(
      {Value<String>? deviceId,
      Value<int>? lastPullCursor,
      Value<DateTime?>? lastSyncAt,
      Value<String?>? lastError,
      Value<int>? rowid}) {
    return InventorySyncStatesCompanion(
      deviceId: deviceId ?? this.deviceId,
      lastPullCursor: lastPullCursor ?? this.lastPullCursor,
      lastSyncAt: lastSyncAt ?? this.lastSyncAt,
      lastError: lastError ?? this.lastError,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (deviceId.present) {
      map['device_id'] = Variable<String>(deviceId.value);
    }
    if (lastPullCursor.present) {
      map['last_pull_cursor'] = Variable<int>(lastPullCursor.value);
    }
    if (lastSyncAt.present) {
      map['last_sync_at'] = Variable<DateTime>(lastSyncAt.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('InventorySyncStatesCompanion(')
          ..write('deviceId: $deviceId, ')
          ..write('lastPullCursor: $lastPullCursor, ')
          ..write('lastSyncAt: $lastSyncAt, ')
          ..write('lastError: $lastError, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$InventoryLocalDatabase extends GeneratedDatabase {
  _$InventoryLocalDatabase(QueryExecutor e) : super(e);
  $InventoryLocalDatabaseManager get managers =>
      $InventoryLocalDatabaseManager(this);
  late final $InventoryCacheEntriesTable inventoryCacheEntries =
      $InventoryCacheEntriesTable(this);
  late final $InventoryOutboxItemsTable inventoryOutboxItems =
      $InventoryOutboxItemsTable(this);
  late final $InventorySyncStatesTable inventorySyncStates =
      $InventorySyncStatesTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities =>
      [inventoryCacheEntries, inventoryOutboxItems, inventorySyncStates];
}

typedef $$InventoryCacheEntriesTableCreateCompanionBuilder
    = InventoryCacheEntriesCompanion Function({
  required String cacheKey,
  required String payload,
  Value<DateTime> cachedAt,
  Value<int> serverCursor,
  Value<int> rowid,
});
typedef $$InventoryCacheEntriesTableUpdateCompanionBuilder
    = InventoryCacheEntriesCompanion Function({
  Value<String> cacheKey,
  Value<String> payload,
  Value<DateTime> cachedAt,
  Value<int> serverCursor,
  Value<int> rowid,
});

class $$InventoryCacheEntriesTableFilterComposer
    extends Composer<_$InventoryLocalDatabase, $InventoryCacheEntriesTable> {
  $$InventoryCacheEntriesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get cacheKey => $composableBuilder(
      column: $table.cacheKey, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get serverCursor => $composableBuilder(
      column: $table.serverCursor, builder: (column) => ColumnFilters(column));
}

class $$InventoryCacheEntriesTableOrderingComposer
    extends Composer<_$InventoryLocalDatabase, $InventoryCacheEntriesTable> {
  $$InventoryCacheEntriesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get cacheKey => $composableBuilder(
      column: $table.cacheKey, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get serverCursor => $composableBuilder(
      column: $table.serverCursor,
      builder: (column) => ColumnOrderings(column));
}

class $$InventoryCacheEntriesTableAnnotationComposer
    extends Composer<_$InventoryLocalDatabase, $InventoryCacheEntriesTable> {
  $$InventoryCacheEntriesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get cacheKey =>
      $composableBuilder(column: $table.cacheKey, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);

  GeneratedColumn<int> get serverCursor => $composableBuilder(
      column: $table.serverCursor, builder: (column) => column);
}

class $$InventoryCacheEntriesTableTableManager extends RootTableManager<
    _$InventoryLocalDatabase,
    $InventoryCacheEntriesTable,
    InventoryCacheEntry,
    $$InventoryCacheEntriesTableFilterComposer,
    $$InventoryCacheEntriesTableOrderingComposer,
    $$InventoryCacheEntriesTableAnnotationComposer,
    $$InventoryCacheEntriesTableCreateCompanionBuilder,
    $$InventoryCacheEntriesTableUpdateCompanionBuilder,
    (
      InventoryCacheEntry,
      BaseReferences<_$InventoryLocalDatabase, $InventoryCacheEntriesTable,
          InventoryCacheEntry>
    ),
    InventoryCacheEntry,
    PrefetchHooks Function()> {
  $$InventoryCacheEntriesTableTableManager(
      _$InventoryLocalDatabase db, $InventoryCacheEntriesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$InventoryCacheEntriesTableFilterComposer(
                  $db: db, $table: table),
          createOrderingComposer: () =>
              $$InventoryCacheEntriesTableOrderingComposer(
                  $db: db, $table: table),
          createComputedFieldComposer: () =>
              $$InventoryCacheEntriesTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> cacheKey = const Value.absent(),
            Value<String> payload = const Value.absent(),
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> serverCursor = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              InventoryCacheEntriesCompanion(
            cacheKey: cacheKey,
            payload: payload,
            cachedAt: cachedAt,
            serverCursor: serverCursor,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String cacheKey,
            required String payload,
            Value<DateTime> cachedAt = const Value.absent(),
            Value<int> serverCursor = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              InventoryCacheEntriesCompanion.insert(
            cacheKey: cacheKey,
            payload: payload,
            cachedAt: cachedAt,
            serverCursor: serverCursor,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$InventoryCacheEntriesTableProcessedTableManager
    = ProcessedTableManager<
        _$InventoryLocalDatabase,
        $InventoryCacheEntriesTable,
        InventoryCacheEntry,
        $$InventoryCacheEntriesTableFilterComposer,
        $$InventoryCacheEntriesTableOrderingComposer,
        $$InventoryCacheEntriesTableAnnotationComposer,
        $$InventoryCacheEntriesTableCreateCompanionBuilder,
        $$InventoryCacheEntriesTableUpdateCompanionBuilder,
        (
          InventoryCacheEntry,
          BaseReferences<_$InventoryLocalDatabase, $InventoryCacheEntriesTable,
              InventoryCacheEntry>
        ),
        InventoryCacheEntry,
        PrefetchHooks Function()>;
typedef $$InventoryOutboxItemsTableCreateCompanionBuilder
    = InventoryOutboxItemsCompanion Function({
  required String eventId,
  required String method,
  required String path,
  required String payload,
  Value<String> status,
  Value<int> attempts,
  Value<String?> lastError,
  Value<DateTime> createdAt,
  Value<DateTime> nextAttemptAt,
  Value<DateTime?> completedAt,
  Value<int> rowid,
});
typedef $$InventoryOutboxItemsTableUpdateCompanionBuilder
    = InventoryOutboxItemsCompanion Function({
  Value<String> eventId,
  Value<String> method,
  Value<String> path,
  Value<String> payload,
  Value<String> status,
  Value<int> attempts,
  Value<String?> lastError,
  Value<DateTime> createdAt,
  Value<DateTime> nextAttemptAt,
  Value<DateTime?> completedAt,
  Value<int> rowid,
});

class $$InventoryOutboxItemsTableFilterComposer
    extends Composer<_$InventoryLocalDatabase, $InventoryOutboxItemsTable> {
  $$InventoryOutboxItemsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get eventId => $composableBuilder(
      column: $table.eventId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get method => $composableBuilder(
      column: $table.method, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get path => $composableBuilder(
      column: $table.path, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get attempts => $composableBuilder(
      column: $table.attempts, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get lastError => $composableBuilder(
      column: $table.lastError, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get nextAttemptAt => $composableBuilder(
      column: $table.nextAttemptAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get completedAt => $composableBuilder(
      column: $table.completedAt, builder: (column) => ColumnFilters(column));
}

class $$InventoryOutboxItemsTableOrderingComposer
    extends Composer<_$InventoryLocalDatabase, $InventoryOutboxItemsTable> {
  $$InventoryOutboxItemsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get eventId => $composableBuilder(
      column: $table.eventId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get method => $composableBuilder(
      column: $table.method, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get path => $composableBuilder(
      column: $table.path, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get attempts => $composableBuilder(
      column: $table.attempts, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get lastError => $composableBuilder(
      column: $table.lastError, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get nextAttemptAt => $composableBuilder(
      column: $table.nextAttemptAt,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get completedAt => $composableBuilder(
      column: $table.completedAt, builder: (column) => ColumnOrderings(column));
}

class $$InventoryOutboxItemsTableAnnotationComposer
    extends Composer<_$InventoryLocalDatabase, $InventoryOutboxItemsTable> {
  $$InventoryOutboxItemsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get eventId =>
      $composableBuilder(column: $table.eventId, builder: (column) => column);

  GeneratedColumn<String> get method =>
      $composableBuilder(column: $table.method, builder: (column) => column);

  GeneratedColumn<String> get path =>
      $composableBuilder(column: $table.path, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get attempts =>
      $composableBuilder(column: $table.attempts, builder: (column) => column);

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get nextAttemptAt => $composableBuilder(
      column: $table.nextAttemptAt, builder: (column) => column);

  GeneratedColumn<DateTime> get completedAt => $composableBuilder(
      column: $table.completedAt, builder: (column) => column);
}

class $$InventoryOutboxItemsTableTableManager extends RootTableManager<
    _$InventoryLocalDatabase,
    $InventoryOutboxItemsTable,
    InventoryOutboxItem,
    $$InventoryOutboxItemsTableFilterComposer,
    $$InventoryOutboxItemsTableOrderingComposer,
    $$InventoryOutboxItemsTableAnnotationComposer,
    $$InventoryOutboxItemsTableCreateCompanionBuilder,
    $$InventoryOutboxItemsTableUpdateCompanionBuilder,
    (
      InventoryOutboxItem,
      BaseReferences<_$InventoryLocalDatabase, $InventoryOutboxItemsTable,
          InventoryOutboxItem>
    ),
    InventoryOutboxItem,
    PrefetchHooks Function()> {
  $$InventoryOutboxItemsTableTableManager(
      _$InventoryLocalDatabase db, $InventoryOutboxItemsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$InventoryOutboxItemsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$InventoryOutboxItemsTableOrderingComposer(
                  $db: db, $table: table),
          createComputedFieldComposer: () =>
              $$InventoryOutboxItemsTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> eventId = const Value.absent(),
            Value<String> method = const Value.absent(),
            Value<String> path = const Value.absent(),
            Value<String> payload = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<int> attempts = const Value.absent(),
            Value<String?> lastError = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> nextAttemptAt = const Value.absent(),
            Value<DateTime?> completedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              InventoryOutboxItemsCompanion(
            eventId: eventId,
            method: method,
            path: path,
            payload: payload,
            status: status,
            attempts: attempts,
            lastError: lastError,
            createdAt: createdAt,
            nextAttemptAt: nextAttemptAt,
            completedAt: completedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String eventId,
            required String method,
            required String path,
            required String payload,
            Value<String> status = const Value.absent(),
            Value<int> attempts = const Value.absent(),
            Value<String?> lastError = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime> nextAttemptAt = const Value.absent(),
            Value<DateTime?> completedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              InventoryOutboxItemsCompanion.insert(
            eventId: eventId,
            method: method,
            path: path,
            payload: payload,
            status: status,
            attempts: attempts,
            lastError: lastError,
            createdAt: createdAt,
            nextAttemptAt: nextAttemptAt,
            completedAt: completedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$InventoryOutboxItemsTableProcessedTableManager
    = ProcessedTableManager<
        _$InventoryLocalDatabase,
        $InventoryOutboxItemsTable,
        InventoryOutboxItem,
        $$InventoryOutboxItemsTableFilterComposer,
        $$InventoryOutboxItemsTableOrderingComposer,
        $$InventoryOutboxItemsTableAnnotationComposer,
        $$InventoryOutboxItemsTableCreateCompanionBuilder,
        $$InventoryOutboxItemsTableUpdateCompanionBuilder,
        (
          InventoryOutboxItem,
          BaseReferences<_$InventoryLocalDatabase, $InventoryOutboxItemsTable,
              InventoryOutboxItem>
        ),
        InventoryOutboxItem,
        PrefetchHooks Function()>;
typedef $$InventorySyncStatesTableCreateCompanionBuilder
    = InventorySyncStatesCompanion Function({
  required String deviceId,
  Value<int> lastPullCursor,
  Value<DateTime?> lastSyncAt,
  Value<String?> lastError,
  Value<int> rowid,
});
typedef $$InventorySyncStatesTableUpdateCompanionBuilder
    = InventorySyncStatesCompanion Function({
  Value<String> deviceId,
  Value<int> lastPullCursor,
  Value<DateTime?> lastSyncAt,
  Value<String?> lastError,
  Value<int> rowid,
});

class $$InventorySyncStatesTableFilterComposer
    extends Composer<_$InventoryLocalDatabase, $InventorySyncStatesTable> {
  $$InventorySyncStatesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get deviceId => $composableBuilder(
      column: $table.deviceId, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get lastPullCursor => $composableBuilder(
      column: $table.lastPullCursor,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get lastSyncAt => $composableBuilder(
      column: $table.lastSyncAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get lastError => $composableBuilder(
      column: $table.lastError, builder: (column) => ColumnFilters(column));
}

class $$InventorySyncStatesTableOrderingComposer
    extends Composer<_$InventoryLocalDatabase, $InventorySyncStatesTable> {
  $$InventorySyncStatesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get deviceId => $composableBuilder(
      column: $table.deviceId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get lastPullCursor => $composableBuilder(
      column: $table.lastPullCursor,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get lastSyncAt => $composableBuilder(
      column: $table.lastSyncAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get lastError => $composableBuilder(
      column: $table.lastError, builder: (column) => ColumnOrderings(column));
}

class $$InventorySyncStatesTableAnnotationComposer
    extends Composer<_$InventoryLocalDatabase, $InventorySyncStatesTable> {
  $$InventorySyncStatesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get deviceId =>
      $composableBuilder(column: $table.deviceId, builder: (column) => column);

  GeneratedColumn<int> get lastPullCursor => $composableBuilder(
      column: $table.lastPullCursor, builder: (column) => column);

  GeneratedColumn<DateTime> get lastSyncAt => $composableBuilder(
      column: $table.lastSyncAt, builder: (column) => column);

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);
}

class $$InventorySyncStatesTableTableManager extends RootTableManager<
    _$InventoryLocalDatabase,
    $InventorySyncStatesTable,
    InventorySyncState,
    $$InventorySyncStatesTableFilterComposer,
    $$InventorySyncStatesTableOrderingComposer,
    $$InventorySyncStatesTableAnnotationComposer,
    $$InventorySyncStatesTableCreateCompanionBuilder,
    $$InventorySyncStatesTableUpdateCompanionBuilder,
    (
      InventorySyncState,
      BaseReferences<_$InventoryLocalDatabase, $InventorySyncStatesTable,
          InventorySyncState>
    ),
    InventorySyncState,
    PrefetchHooks Function()> {
  $$InventorySyncStatesTableTableManager(
      _$InventoryLocalDatabase db, $InventorySyncStatesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$InventorySyncStatesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$InventorySyncStatesTableOrderingComposer(
                  $db: db, $table: table),
          createComputedFieldComposer: () =>
              $$InventorySyncStatesTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> deviceId = const Value.absent(),
            Value<int> lastPullCursor = const Value.absent(),
            Value<DateTime?> lastSyncAt = const Value.absent(),
            Value<String?> lastError = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              InventorySyncStatesCompanion(
            deviceId: deviceId,
            lastPullCursor: lastPullCursor,
            lastSyncAt: lastSyncAt,
            lastError: lastError,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String deviceId,
            Value<int> lastPullCursor = const Value.absent(),
            Value<DateTime?> lastSyncAt = const Value.absent(),
            Value<String?> lastError = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              InventorySyncStatesCompanion.insert(
            deviceId: deviceId,
            lastPullCursor: lastPullCursor,
            lastSyncAt: lastSyncAt,
            lastError: lastError,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$InventorySyncStatesTableProcessedTableManager = ProcessedTableManager<
    _$InventoryLocalDatabase,
    $InventorySyncStatesTable,
    InventorySyncState,
    $$InventorySyncStatesTableFilterComposer,
    $$InventorySyncStatesTableOrderingComposer,
    $$InventorySyncStatesTableAnnotationComposer,
    $$InventorySyncStatesTableCreateCompanionBuilder,
    $$InventorySyncStatesTableUpdateCompanionBuilder,
    (
      InventorySyncState,
      BaseReferences<_$InventoryLocalDatabase, $InventorySyncStatesTable,
          InventorySyncState>
    ),
    InventorySyncState,
    PrefetchHooks Function()>;

class $InventoryLocalDatabaseManager {
  final _$InventoryLocalDatabase _db;
  $InventoryLocalDatabaseManager(this._db);
  $$InventoryCacheEntriesTableTableManager get inventoryCacheEntries =>
      $$InventoryCacheEntriesTableTableManager(_db, _db.inventoryCacheEntries);
  $$InventoryOutboxItemsTableTableManager get inventoryOutboxItems =>
      $$InventoryOutboxItemsTableTableManager(_db, _db.inventoryOutboxItems);
  $$InventorySyncStatesTableTableManager get inventorySyncStates =>
      $$InventorySyncStatesTableTableManager(_db, _db.inventorySyncStates);
}
