import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { ExtractionProcessor } from './processors/extraction.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: new URL(configService.get<string>('redis.url') || 'redis://localhost:6379').hostname,
          port: parseInt(
            new URL(configService.get<string>('redis.url') || 'redis://localhost:6379').port || '6379',
            10,
          ),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'extraction',
    }),
    PrismaModule,
    GeminiModule,
  ],
  providers: [QueueService, ExtractionProcessor],
  exports: [QueueService],
})
export class QueueModule {}
