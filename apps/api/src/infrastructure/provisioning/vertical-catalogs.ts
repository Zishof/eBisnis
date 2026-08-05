/**
 * Daftar katalog vertikal yang disemai.
 *
 * ## Mengapa daftar tetap, bukan pendaftaran lewat daur hidup modul
 *
 * Percobaan pertama mendaftarkan katalog pada `onModuleInit()` tiap modul
 * vertikal. Bentuk itu lebih rapi lapisannya, dan **salah** — sebab isi
 * registri lalu bergantung pada modul mana yang kebetulan dimuat.
 *
 * Aplikasi HTTP memuat seluruh modul. CLI penyemai hanya memuat
 * `InfrastructureModule`. Akibatnya `pnpm migrate:tenants` menyemai 139 menu
 * sedangkan pendaftaran lewat API menyemai 162 — dua jalur, dua hasil, tanpa
 * satu pun galat. Penyewa yang disemai lewat jalur yang salah kehilangan
 * seluruh layar koperasi, dan tidak ada yang mengetahuinya sampai seseorang
 * membukanya.
 *
 * Daftar tetap ini menghapus perbedaan itu: kedua jalur membaca hal yang sama.
 *
 * Harganya adalah satu berkas bersama yang perlu disunting saat vertikal baru
 * ditambahkan. Itu memang yang hendak dihindari IR-004 — tetapi yang dihindari
 * IR-004 adalah menyunting `MENU_TREE_SEED` dan `ROLE_CATALOG`, dua konstanta
 * besar tempat konflik penggabungan berbahaya. Berkas ini panjangnya belasan
 * baris dan berisi satu entri per vertikal; konfliknya terlihat dan sepele.
 *
 * Urutannya menentukan: inti lebih dahulu, supaya vertikal yang bertabrakan
 * dengan menu inti ditolak secara terbuka alih-alih menimpanya.
 */

import { CORE_VERTICAL_CATALOG } from './core-vertical.catalog';
import { COOPERATIVE_VERTICAL_CATALOG } from '../../modules/cooperative/rbac/cooperative-vertical.catalog';
import { ESCHOOL_VERTICAL_CATALOG } from '../../modules/education/rbac/eschool-vertical.catalog';
import { PESANTREN_VERTICAL_CATALOG } from '../../modules/pesantren/rbac/pesantren-vertical.catalog';
import type { VerticalCatalog } from './vertical-catalog.registry';

export const VERTICAL_CATALOGS: VerticalCatalog[] = [
  CORE_VERTICAL_CATALOG,
  COOPERATIVE_VERTICAL_CATALOG,
  PESANTREN_VERTICAL_CATALOG,
  ESCHOOL_VERTICAL_CATALOG,
];
