import { Controller, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { ProductMediaService } from '../../infrastructure/files/product-media.service';

const ALLOWED_IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface UploadedImage {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@ApiTags('inventory')
@ApiBearerAuth('access-token')
@Controller('inventory/products')
export class InventoryMediaAdminController {
  constructor(private readonly media: ProductMediaService) {}

  @Permissions('PRODUCT.UPDATE')
  @Post(':productId/image')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Mengganti gambar produk khusus tenant' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  upload(
    @Param('productId') productId: string,
    @UploadedFile() file: UploadedImage | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.schemaName) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks tenant tidak ditemukan.');
    }
    if (!file) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Berkas gambar wajib disertakan.');
    }
    if (!ALLOWED_IMAGES.has(file.mimetype)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Gunakan gambar JPEG, PNG, atau WEBP dengan ukuran maksimum 5 MB.',
      );
    }
    return this.media.saveTenantOverride(
      user.schemaName,
      productId,
      { filename: file.originalname, mimeType: file.mimetype, buffer: file.buffer },
      user.userId,
    );
  }
}
