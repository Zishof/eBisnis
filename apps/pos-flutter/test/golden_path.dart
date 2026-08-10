import 'dart:io' show Platform;

/// Golden bersifat spesifik platform karena Skia merasterisasi glyph secara
/// berbeda pada Windows dan Linux. CI Ubuntu tetap memakai baseline lama;
/// workstation Windows memakai baseline terpisah agar keduanya tetap ketat.
String goldenPath(String fileName) =>
    Platform.isWindows ? 'goldens/windows/$fileName' : 'goldens/$fileName';
