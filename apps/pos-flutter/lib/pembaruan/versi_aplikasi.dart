/// Versi yang sedang berjalan.
///
/// Disuntikkan saat dibangun oleh alur rilis:
///
///   flutter build windows --dart-define=VERSI=1.2.0
///
/// Nilai bawaannya wajib sama dengan `version:` pada `pubspec.yaml`, dan itu
/// dijaga uji — bukan kebiasaan. Bila keduanya berbeda, aplikasi yang dibangun
/// di luar alur rilis akan membandingkan dirinya dengan angka yang salah dan
/// menyimpulkan "sudah versi terbaru" pada mesin kasir yang tertinggal.
library;

const String versiAplikasi =
    String.fromEnvironment('VERSI', defaultValue: '0.1.21');
