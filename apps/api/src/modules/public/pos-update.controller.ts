import { Controller, Get, Headers, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { Public } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { rawResponse } from '../../common/interceptors/response-envelope.interceptor';

type PlatformAsset = 'windows' | 'android';

interface PosAsset {
  name: string;
  path: string;
  size: number;
  platform: PlatformAsset;
  version: string;
}

const UPDATE_DIR = process.env.POS_UPDATE_DIR || '/opt/ebisnis/updates/pos';
const FILE_PATTERN = /^ebisnis-pos-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)(?:-windows)?\.(exe|apk)$/;

@ApiTags('public')
@Controller('update')
export class PosUpdateController {
  @Public()
  @Get(['pos/latest', 'pos/latest.json'])
  @ApiOperation({ summary: 'Metadata rilis terakhir POS Flutter' })
  latest(@Headers('host') host: string, @Headers('x-forwarded-proto') proto?: string) {
    const assets = this.assets();
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
    return this.downloadExplicitApp('ebisnis-inventory-sales.apk', res, 'APK inventory sales belum tersedia.');
  }

  @Public()
  @Get('ebisnis-inventory-sales.exe')
  @ApiOperation({ summary: 'Unduh EXE sales inventory demo' })
  downloadInventorySalesExe(@Res({ passthrough: true }) res: Response) {
    return this.downloadExplicitApp('ebisnis-inventory-sales.exe', res, 'EXE inventory sales belum tersedia.');
  }

  @Public()
  @Get('pos/:file')
  @ApiOperation({ summary: 'Unduh installer POS Flutter' })
  download(@Param('file') file: string, @Res({ passthrough: true }) res: Response) {
    const safe = basename(file);
    if (safe !== file || !FILE_PATTERN.test(file)) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berkas pembaruan tidak ditemukan.');
    }

    const path = this.updateFilePath(safe);
    if (!path) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berkas pembaruan tidak ditemukan.');
    }

    return this.streamFile(path, safe, res, 'immutable');
  }

  private assets(): PosAsset[] {
    if (!existsSync(UPDATE_DIR)) return [];
    return readdirSync(UPDATE_DIR)
      .map((name) => {
        const match = FILE_PATTERN.exec(name);
        if (!match) return null;
        const path = join(UPDATE_DIR, name);
        const stat = statSync(path);
        if (!stat.isFile()) return null;
        return {
          name,
          path,
          size: stat.size,
          platform: match[2] === 'apk' ? 'android' : 'windows',
          version: match[1],
        } satisfies PosAsset;
      })
      .filter((a): a is PosAsset => a !== null);
  }

  private downloadLatestCustomerApk(aliasName: string, res: Response) {
    const explicitApk = this.updateFilePath(aliasName);
    if (explicitApk) {
      return this.streamFile(explicitApk, aliasName, res, 'latest');
    }

    const apk = this.assets()
      .filter((asset) => asset.platform === 'android')
      .sort((a, b) => compareVersion(a.version, b.version))
      .at(-1);

    if (!apk) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        'APK pelanggan belum tersedia. Unggah berkas .apk ke folder pembaruan POS atau GitHub Release.',
      );
    }

    return this.streamFile(apk.path, aliasName, res, 'latest');
  }

  private downloadExplicitApp(aliasName: string, res: Response, message: string) {
    const explicit = this.updateFilePath(aliasName);
    if (explicit) {
      return this.streamFile(explicit, aliasName, res, 'latest');
    }

    throw AppError.notFound(
      ErrorCodes.NOT_FOUND,
      `${message} Unggah berkas ${aliasName} ke folder pembaruan POS atau GitHub Release.`,
    );
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

  private streamFile(path: string, filename: string, res: Response, cacheMode: 'immutable' | 'latest') {
    const ext = filename.endsWith('.apk') ? 'apk' : 'exe';
    res.set({
      'Content-Type':
        ext === 'apk' ? 'application/vnd.android.package-archive' : 'application/vnd.microsoft.portable-executable',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': cacheMode === 'immutable' ? 'public, max-age=31536000, immutable' : 'no-cache',
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
