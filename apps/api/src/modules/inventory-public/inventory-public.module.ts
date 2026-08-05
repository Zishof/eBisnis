import { Module } from '@nestjs/common';
import { InventoryPublicController } from './inventory-public.controller';
import { InventoryPublicService } from './inventory-public.service';
import { InventoryMediaAdminController } from './inventory-media-admin.controller';

@Module({
  controllers: [InventoryPublicController, InventoryMediaAdminController],
  providers: [InventoryPublicService],
})
export class InventoryPublicModule {}
