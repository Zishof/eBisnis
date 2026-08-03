# Isi bersama untuk VirtualHost :80 dan :443 eBisnis.id.
#
# Dipasang pada /etc/apache2/conf-available/ebisnis-app.inc dan dipanggil dengan
# `Include` dari kedua VirtualHost, sehingga aturannya tidak perlu ditulis dua
# kali dan tidak mungkin berbeda antara HTTP dan HTTPS.
#
# Bergantung pada dua variabel yang didefinisikan di ebisnis.conf:
#   EBISNIS_WEB_ROOT   direktori hasil build React
#   EBISNIS_API        alamat internal NestJS

DocumentRoot ${EBISNIS_WEB_ROOT}

# ---------------------------------------------------------------------------
# Warisan context path lama.
#
# Sistem Java sebelumnya disajikan pada /ebisnis/, dan konfigurasi lama
# mengalihkan / ke sana. Tautan, bookmark, dan redirect yang tersimpan di cache
# browser masih menunjuk ke situ. Tanpa aturan ini, pengunjung tetap membuka
# aplikasi (karena FallbackResource melayani index.html untuk path apa pun),
# tetapi dengan URL yang keliru dan tautan dalam aplikasi menjadi rancu.
#
# 302, bukan 301, supaya tidak tersimpan permanen di browser selama masa
# transisi. Ubah menjadi 301 setelah yakin tidak ada lagi yang memakai /ebisnis/.
# ---------------------------------------------------------------------------
RewriteEngine On
RewriteRule ^/ebisnis/?$      / [R=302,L]
RewriteRule ^/ebisnis/(.*)$   /$1 [R=302,L]

ProxyPreserveHost On
ProxyRequests Off

# ---------------------------------------------------------------------------
# Jalur yang diteruskan ke NestJS.
#
# URUTAN PENTING: seluruh ProxyPass harus berada sebelum penyajian berkas
# statis, agar permintaan API tidak ikut tertangkap FallbackResource dan
# dibalas index.html.
# ---------------------------------------------------------------------------
ProxyPass        /update/  ${EBISNIS_API}/api/v1/update/  retry=0 timeout=120
ProxyPassReverse /update/  ${EBISNIS_API}/api/v1/update/

ProxyPass        /api/      ${EBISNIS_API}/api/      retry=0 timeout=120
ProxyPassReverse /api/      ${EBISNIS_API}/api/

ProxyPass        /health    ${EBISNIS_API}/health    retry=0 timeout=15
ProxyPassReverse /health    ${EBISNIS_API}/health

# Swagger. Nonaktifkan kedua baris ini bila dokumentasi API tidak boleh
# diakses publik.
ProxyPass        /docs      ${EBISNIS_API}/docs      retry=0
ProxyPassReverse /docs      ${EBISNIS_API}/docs
ProxyPass        /docs-yaml ${EBISNIS_API}/docs-yaml retry=0
ProxyPassReverse /docs-yaml ${EBISNIS_API}/docs-yaml

# ---------------------------------------------------------------------------
# Penyajian aplikasi React.
# ---------------------------------------------------------------------------
<Directory ${EBISNIS_WEB_ROOT}>
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted

    # Seluruh route klien dilayani index.html. Inilah yang membuat akses
    # langsung ke /daftar, /harga, /masuk, /app/products, dan /platform/tenants
    # berfungsi, bukan menghasilkan 404.
    FallbackResource /index.html
</Directory>

# Berkas ber-hash dari Vite aman di-cache lama; index.html tidak boleh, agar
# pengguna langsung mendapat versi baru setelah update.
<IfModule mod_expires.c>
    ExpiresActive On
    <LocationMatch "^/assets/">
        ExpiresDefault "access plus 1 year"
        Header set Cache-Control "public, max-age=31536000, immutable"
    </LocationMatch>
</IfModule>

<Files "index.html">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
</Files>

<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css text/plain \
        application/javascript application/json image/svg+xml
</IfModule>

# ---------------------------------------------------------------------------
# Header keamanan.
# ---------------------------------------------------------------------------
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    # Aktifkan HSTS hanya setelah HTTPS memakai sertifikat tepercaya dan
    # seluruh subdomain sudah siap. Sulit dibatalkan karena browser
    # mengingatnya.
    # Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
</IfModule>
