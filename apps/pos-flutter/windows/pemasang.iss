; Pemasang Windows untuk klien kasir eBisnis.id.
;
; Flutter menghasilkan sebuah FOLDER (exe + DLL + assets), bukan satu berkas.
; Membagikan folder itu sebagai zip berarti setiap gerai menyalinnya sendiri ke
; tempat yang berbeda-beda, dan pembaruan berikutnya harus menebak di mana. Satu
; berkas .exe pemasang menyelesaikan keduanya: penempatannya seragam, dan
; pemasangan berikutnya menimpa yang lama di tempat yang sama.
;
; Dibangun oleh .github/workflows/rilis-pos.yml:
;   ISCC /DVersi=1.2.0 /DSumber=... /DKeluaran=... pemasang.iss

#define NamaApl "eBisnis POS"
#define Penerbit "eBisnis.id"
#define Situs "https://ebisnis.id"
#define BerkasExe "ebisnis_pos.exe"

#ifndef Versi
  #define Versi "0.0.0"
#endif
#ifndef Sumber
  #define Sumber "..\build\windows\x64\runner\Release"
#endif
#ifndef Keluaran
  #define Keluaran "..\build\pemasang"
#endif

[Setup]
; AppId ini PERMANEN.
;
; Windows memakainya untuk mengenali pemasangan yang sudah ada. Bila diubah,
; pemasang berikutnya tidak melihat versi lama dan memasang aplikasi KEDUA
; berdampingan — dua ikon, dua penyimpanan lokal, dan kasir yang membuka yang
; salah lalu tidak menemukan transaksinya.
AppId={{8E2B4F31-0C7A-4D96-9B55-1F3E7A2C6D40}
AppName={#NamaApl}
AppVersion={#Versi}
AppVerName={#NamaApl} {#Versi}
AppPublisher={#Penerbit}
AppPublisherURL={#Situs}
VersionInfoVersion={#Versi}

; Dipasang per pengguna, tanpa hak administrator.
;
; Mesin kasir di gerai umumnya memakai akun terbatas, dan meminta kata sandi
; administrator setiap kali memperbarui berarti pembaruannya tidak pernah
; dijalankan.
PrivilegesRequired=lowest
DefaultDirName={autopf}\{#NamaApl}
DefaultGroupName={#NamaApl}
DisableProgramGroupPage=yes

; Menutup aplikasi yang sedang berjalan sebelum menimpa berkasnya, alih-alih
; gagal di tengah jalan dengan pesan "berkas sedang dipakai".
CloseApplications=yes
RestartApplications=no

OutputDir={#Keluaran}
OutputBaseFilename=ebisnis-pos-{#Versi}-windows
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; Nilai `x64`, bukan `x64compatible`: yang terakhir baru dikenal Inno Setup 6.3,
; dan runner GitHub tidak menjanjikan versi tertentu.
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64

[Languages]
Name: "id"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Buat pintasan di desktop"; GroupDescription: "Pintasan:"

[Files]
Source: "{#Sumber}\{#BerkasExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#Sumber}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#NamaApl}"; Filename: "{app}\{#BerkasExe}"
Name: "{autodesktop}\{#NamaApl}"; Filename: "{app}\{#BerkasExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#BerkasExe}"; Description: "Jalankan {#NamaApl}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Sengaja TIDAK menghapus data aplikasi.
;
; Buku transaksi luring hidup di folder data pengguna. Mencopot aplikasi tidak
; boleh menghapusnya: pencopotan yang paling sering terjadi adalah pencopotan
; untuk memasang ulang, dan transaksi yang belum terkirim ke peladen hanya ada
; di sana.
Type: dirifempty; Name: "{app}"
