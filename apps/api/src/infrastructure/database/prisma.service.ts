import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'production'
          ? [{ emit: 'event', level: 'error' }]
          : [{ emit: 'event', level: 'error' }, { emit: 'event', level: 'warn' }],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Platform Prisma client terhubung.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
