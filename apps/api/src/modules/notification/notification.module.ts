/**
 * Notification Hub — lonceng, tindak lanjut, dan keadaan kanal.
 */

import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import {
  AuthenticatedOnly,
  AuthenticatedUser,
  CurrentUser,
  Permissions,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { NotificationService } from './notification.service';
import { SlaEscalationService } from './sla-escalation.service';

class MarkReadDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ids!: string[];
}

function schemaOf(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.badRequest(
      ErrorCodes.VALIDATION_FAILED,
      'Sesi ini tidak terhubung ke tenant mana pun.',
    );
  }
  return user.schemaName;
}

@ApiTags('notification')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly escalation: SlaEscalationService,
  ) {}

  @Get()
  @AuthenticatedOnly()
  @ApiOperation({
    summary: 'Isi lonceng',
    description:
      'Yang MENUNTUT TINDAKAN didahulukan, bukan yang terbaru. Lonceng yang mengurutkan ' +
      'menurut waktu akan mengubur permintaan persetujuan kemarin di bawah sepuluh kabar ' +
      'hari ini. Pemberitahuan yang ditujukan kepada peran ikut tampil bagi setiap ' +
      'pemegang peran itu.',
  })
  @ApiQuery({ name: 'jumlah', required: false, type: Number })
  bell(@CurrentUser() user: AuthenticatedUser, @Query('jumlah') limit?: string) {
    return this.notifications.bell(schemaOf(user), user, Number(limit) || 20);
  }

  @Post('baca')
  @AuthenticatedOnly()
  @ApiOperation({ summary: 'Menandai sudah dibaca' })
  markRead(@Body() dto: MarkReadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(schemaOf(user), user, dto.ids);
  }

  @Post(':id/tindaklanjuti')
  @AuthenticatedOnly()
  @ApiOperation({
    summary: 'Menandai sudah ditindaklanjuti',
    description:
      'Berbeda dari dibaca. Melihat permintaan persetujuan tidak sama dengan menyetujuinya, ' +
      'dan lonceng yang menganggapnya sama akan menyembunyikan pekerjaan yang belum selesai.',
  })
  markActed(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markActed(schemaOf(user), user, id);
  }

  @Post(':id/tutup')
  @AuthenticatedOnly()
  @ApiOperation({
    summary: 'Menutup tanpa menindaklanjuti',
    description:
      'Ditolak untuk pemberitahuan yang menuntut tindakan — menutupnya akan membuat ' +
      'pekerjaan orang lain berhenti menunggu tanpa ada yang tahu sebabnya.',
  })
  dismiss(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.dismiss(schemaOf(user), user, id);
  }

  @Post('sapu-sla')
  @Permissions('SURAT_KELUAR.APPROVE')
  @ApiOperation({
    summary: 'Memeriksa batas waktu persetujuan sekarang juga',
    description:
      'Pemeriksaan yang sama berjalan otomatis tiap jam. Endpoint ini memaksanya sekarang — ' +
      'berguna setelah alur diubah, dan membuat eskalasi dapat diuji tanpa menunggu satu jam. ' +
      'Aman dipanggil berulang: eskalasi yang sama dikelompokkan, bukan digandakan.',
  })
  sweepSla(@CurrentUser() user: AuthenticatedUser) {
    return this.escalation.sweep(schemaOf(user));
  }

  @Get('kanal')
  @AuthenticatedOnly()
  @ApiOperation({
    summary: 'Keadaan setiap kanal pengiriman',
    description:
      'Kanal yang belum berkredensial dilaporkan apa adanya beserta apa yang kurang — ' +
      'bukan dilaporkan berhasil, yang akan membuat orang mengira sudah diberi tahu.',
  })
  channels() {
    return this.notifications.channelStatus();
  }
}

@Module({
  imports: [InfrastructureModule],
  controllers: [NotificationController],
  providers: [NotificationService, SlaEscalationService],
  exports: [NotificationService, SlaEscalationService],
})
export class NotificationModule {}
