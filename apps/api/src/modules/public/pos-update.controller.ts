import { Controller, Get, Headers, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { Public } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { rawResponse } from '../../common/interceptors/response-envelope.interceptor';

type PlatformAsset = 'windows' | 'android';
export type UpdateProduct = 'pos' | 'inventory' | 'apotik';

interface PosAsset {
  name: string;
  path: string;
  size: number;
  platform: PlatformAsset;
  version: string;
  product: UpdateProduct;
}

const UPDATE_DIR = process.env.POS_UPDATE_DIR || '/opt/ebisnis/updates/pos';
const VERSION_PART = String.raw`(\d+\.\d+\.\d+(?:-(?!windows(?:\.|$))[0-9A-Za-z.]+)?)`;
const FILE_PATTERN = new RegExp(`^ebisnis-pos-${VERSION_PART}(?:-windows)?\\.(exe|apk)$`);
const INVENTORY_FILE_PATTERN = new RegExp(
  `^ebisnis-inventory-sales-${VERSION_PART}(?:-windows)?\\.(exe|apk)$`,
);
const APOTIK_FILE_PATTERN = new RegExp(
  `^emedik-pos-apotik-${VERSION_PART}(?:-windows)?\\.(exe|apk)$`,
);

export function parseUpdateAssetFilename(product: UpdateProduct, name: string) {
  const pattern =
    product === 'inventory'
      ? INVENTORY_FILE_PATTERN
      : product === 'apotik'
        ? APOTIK_FILE_PATTERN
        : FILE_PATTERN;
  const match = pattern.exec(name);
  if (!match) return null;
  return {
    version: match[1],
    platform: (match[2] === 'apk' ? 'android' : 'windows') as PlatformAsset,
  };
}

@ApiTags('public')
@Controller('update')
export class PosUpdateController {
  @Public()
  @Get(['pos/latest', 'pos/latest.json'])
  @ApiOperation({ summary: 'Metadata rilis terakhir POS Flutter' })
  latest(@Headers('host') host: string, @Headers('x-forwarded-proto') proto?: string) {
    const assets = this.assets('pos');
    if (!assets.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Belum ada berkas pembaruan POS.');
    }

    const latestVersion = assets.map((a) => a.version).sort(compareVersion).at(-1)!;
    const latestAssets = assets.filter((a) => a.version === latestVersion);
    const base = `${proto === 'http' ? 'http' : 'https'}://${host}`;

    return rawResponse({
      tag_name: `pos-v${latestVersion}`,
      name: `eBisnis POS ${latestVersion}`,
      draft: false,
      prerelease: latestVersion.includes('-'),
      body:
        'Pembaruan eBisnis POS disajikan dari server eBisnis. ' +
        'Kode sumber tetap berada di repository private.',
      assets: latestAssets.map((a) => ({
        name: a.name,
        size: a.size,
        browser_download_url: `${base}/update/pos/${a.name}`,
      })),
    });
  }

  @Public()
  @Get(['inventory/latest', 'inventory/latest.json'])
  @ApiOperation({ summary: 'Metadata rilis terakhir aplikasi sales inventory Flutter' })
  latestInventory(@Headers('host') host: string, @Headers('x-forwarded-proto') proto?: string) {
    const assets = this.assets('inventory');
    if (!assets.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Belum ada berkas pembaruan inventory sales.');
    }

    const latestVersion = assets.map((a) => a.version).sort(compareVersion).at(-1)!;
    const latestAssets = assets.filter((a) => a.version === latestVersion);
    const base = `${proto === 'http' ? 'http' : 'https'}://${host}`;

    return rawResponse({
      tag_name: `inventory-v${latestVersion}`,
      name: `eBisnis Inventory Sales ${latestVersion}`,
      draft: false,
      prerelease: latestVersion.includes('-'),
      body:
        'Pembaruan eBisnis Inventory Sales disajikan dari server eBisnis. ' +
        'Kode sumber tetap berada di repository private.',
      assets: latestAssets.map((a) => ({
        name: a.name,
        size: a.size,
        browser_download_url: `${base}/update/inventory/${a.name}`,
      })),
    });
  }

  @Public()
  @Get(['apotik/latest', 'apotik/latest.json'])
  @ApiOperation({ summary: 'Metadata rilis terakhir POS Apotik eMedik' })
  latestApotik(@Headers('host') host: string, @Headers('x-forwarded-proto') proto?: string) {
    const assets = this.assets('apotik');
    if (!assets.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Belum ada berkas POS Apotik eMedik.');
    }

    const latestVersion = assets.map((a) => a.version).sort(compareVersion).at(-1)!;
    const latestAssets = assets.filter((a) => a.version === latestVersion);
    const base = `${proto === 'http' ? 'http' : 'https'}://${host}`;

    return rawResponse({
      tag_name: `apotik-pos-v${latestVersion}`,
      name: `POS Apotik eMedik ${latestVersion}`,
      draft: false,
      prerelease: latestVersion.includes('-'),
      body: 'POS Apotik eMedik untuk Windows 64-bit dan Android.',
      assets: latestAssets.map((a) => ({
        name: a.name,
        size: a.size,
        browser_download_url: `${base}/update/apotik/${a.name}`,
      })),
    });
  }

  @Public()
  @Get('ebisnis-pelanggan-demo.apk')
  @ApiOperation({ summary: 'Unduh APK pelanggan demo' })
  downloadDemoCustomerApk(@Res({ passthrough: true }) res: Response) {
    return this.downloadLatestCustomerApk('ebisnis-pelanggan-demo.apk', res);
  }

  @Public()
  @Get('ebisnis-pelanggan-salon.apk')
  @ApiOperation({ summary: 'Unduh APK pelanggan salon demo' })
  downloadSalonCustomerApk(@Res({ passthrough: true }) res: Response) {
    return this.downloadLatestCustomerApk('ebisnis-pelanggan-salon.apk', res);
  }

  @Public()
  @Get('ebisnis-inventory-sales.apk')
  @ApiOperation({ summary: 'Unduh APK sales inventory demo' })
  downloadInventorySalesApk(@Res({ passthrough: true }) res: Response) {
    return this.downloadExplicitApp('ebisnis-inventory-sales.apk', res, 'APK inventory sales belum tersedia.', 'inventory', 'android');
  }

  @Public()
  @Get('ebisnis-inventory-sales.exe')
  @ApiOperation({ summary: 'Unduh EXE sales inventory demo' })
  downloadInventorySalesExe(@Res({ passthrough: true }) res: Response) {
    return this.downloadExplicitApp('ebisnis-inventory-sales.exe', res, 'EXE inventory sales belum tersedia.', 'inventory', 'windows');
  }

  @Public()
  @Get('pos-apotik-windows.exe')
  @ApiOperation({ summary: 'Unduh installer Windows POS Apotik terbaru' })
  downloadApotikWindows(@Res({ passthrough: true }) res: Response) {
    return this.downloadLatestAlias(
      'pos-apotik-windows.exe',
      'apotik',
      'windows',
      res,
      'Installer Windows POS Apotik belum tersedia.',
    );
  }

  @Public()
  @Get('pos-apotik-android.apk')
  @ApiOperation({ summary: 'Unduh APK Android POS Apotik terbaru' })
  downloadApotikAndroid(@Res({ passthrough: true }) res: Response) {
    return this.downloadLatestAlias(
      'pos-apotik-android.apk',
      'apotik',
      'android',
      res,
      'APK Android POS Apotik belum tersedia.',
    );
  }

  @Public()
  @Get('pos/:file')
  @ApiOperation({ summary: 'Unduh installer POS Flutter' })
  download(@Param('file') file: string, @Res({ passthrough: true }) res: Response) {
    const safe = basename(file);
    if (safe !== file || !FILE_PATTERN.test(file)) {
      this.noStore(res);
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berkas pembaruan tidak ditemukan.');
    }

    const path = this.updateFilePath(safe);
    if (!path) {
      this.noStore(res);
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berkas pembaruan tidak ditemukan.');
    }

    return this.streamFile(path, safe, res, 'immutable');
  }

  @Public()
  @Get('inventory/:file')
  @ApiOperation({ summary: 'Unduh installer inventory sales Flutter' })
  downloadInventoryVersioned(@Param('file') file: string, @Res({ passthrough: true }) res: Response) {
    const safe = basename(file);
    if (safe !== file || !INVENTORY_FILE_PATTERN.test(file)) {
      this.noStore(res);
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berkas pembaruan inventory tidak ditemukan.');
    }

    const path = this.updateFilePath(safe);
    if (!path) {
      this.noStore(res);
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berkas pembaruan inventory tidak ditemukan.');
    }

    return this.streamFile(path, safe, res, 'immutable');
  }

  @Public()
  @Get('apotik/:file')
  @ApiOperation({ summary: 'Unduh rilis bernomor POS Apotik eMedik' })
  downloadApotikVersioned(@Param('file') file: string, @Res({ passthrough: true }) res: Response) {
    const safe = basename(file);
    if (safe !== file || !APOTIK_FILE_PATTERN.test(file)) {
      this.noStore(res);
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berkas POS Apotik tidak ditemukan.');
    }

    const path = this.updateFilePath(safe);
    if (!path) {
      this.noStore(res);
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berkas POS Apotik tidak ditemukan.');
    }

    return this.streamFile(path, safe, res, 'immutable');
  }

  private assets(product: UpdateProduct): PosAsset[] {
    if (!existsSync(UPDATE_DIR)) return [];
    return readdirSync(UPDATE_DIR)
      .map((name) => {
        const parsed = parseUpdateAssetFilename(product, name);
        if (!parsed) return null;
        const path = join(UPDATE_DIR, name);
        const stat = statSync(path);
        if (!stat.isFile()) return null;
        return {
          name,
          path,
          size: stat.size,
          platform: parsed.platform,
          version: parsed.version,
          product,
        } satisfies PosAsset;
      })
      .filter((a): a is PosAsset => a !== null);
  }

  private downloadLatestCustomerApk(aliasName: string, res: Response) {
    const explicitApk = this.updateFilePath(aliasName);
    if (explicitApk) {
      return this.streamFile(explicitApk, aliasName, res, 'latest');
    }

    const apk = this.latestAsset('pos', 'android');

    if (!apk) {
      this.noStore(res);
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        'APK pelanggan belum tersedia. Unggah berkas .apk ke folder pembaruan POS atau GitHub Release.',
      );
    }

    return this.streamFile(apk.path, aliasName, res, 'latest');
  }

  private downloadExplicitApp(
    aliasName: string,
    res: Response,
    message: string,
    product?: UpdateProduct,
    platform?: PlatformAsset,
  ) {
    const explicit = this.updateFilePath(aliasName);
    if (explicit) {
      return this.streamFile(explicit, aliasName, res, 'latest');
    }

    if (product && platform) {
      const asset = this.latestAsset(product, platform);
      if (asset) {
        return this.streamFile(asset.path, aliasName, res, 'latest');
      }
    }

    this.noStore(res);
    throw AppError.notFound(
      ErrorCodes.NOT_FOUND,
      `${message} Unggah berkas ${aliasName} ke folder pembaruan POS atau GitHub Release.`,
    );
  }

  private downloadLatestAlias(
    aliasName: string,
    product: UpdateProduct,
    platform: PlatformAsset,
    res: Response,
    message: string,
  ) {
    const asset = this.latestAsset(product, platform);
    if (!asset) {
      this.noStore(res);
      throw AppError.notFound(ErrorCodes.NOT_FOUND, message);
    }
    return this.streamFile(asset.path, asset.name, res, 'latest');
  }

  private updateFilePath(file: string): string | null {
    const safe = basename(file);
    if (safe !== file) return null;

    const root = resolve(UPDATE_DIR);
    const path = resolve(join(root, safe));
    if (!path.startsWith(`${root}\\`) && !path.startsWith(`${root}/`)) return null;
    if (!existsSync(path)) return null;
    if (!statSync(path).isFile()) return null;
    return path;
  }

  private latestAsset(product: UpdateProduct, platform: PlatformAsset): PosAsset | undefined {
    return this.assets(product)
      .filter((candidate) => candidate.platform === platform)
      .sort((a, b) => compareVersion(a.version, b.version))
      .at(-1);
  }

  private noStore(res: Response): void {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    });
  }

  private streamFile(path: string, filename: string, res: Response, cacheMode: 'immutable' | 'latest') {
    const ext = filename.endsWith('.apk') ? 'apk' : 'exe';
    const size = statSync(path).size;
    res.set({
      'Content-Type':
        ext === 'apk' ? 'application/vnd.android.package-archive' : 'application/vnd.microsoft.portable-executable',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(size),
      'Cache-Control': cacheMode === 'immutable' ? 'public, max-age=31536000, immutable' : 'no-cache, must-revalidate',
    });
    return rawResponse(new StreamableFile(createReadStream(path)));
  }
}

function compareVersion(a: string, b: string): number {
  const [coreA, preA = ''] = a.split('-');
  const [coreB, preB = ''] = b.split('-');
  const partA = coreA.split('.').map((n) => Number.parseInt(n, 10));
  const partB = coreB.split('.').map((n) => Number.parseInt(n, 10));
  for (let i = 0; i < Math.max(partA.length, partB.length); i++) {
    const diff = (partA[i] ?? 0) - (partB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (preA === preB) return 0;
  if (!preA) return 1;
  if (!preB) return -1;
  return preA.localeCompare(preB);
}
