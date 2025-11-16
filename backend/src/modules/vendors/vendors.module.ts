import { Module } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { GeminiModule } from '../gemini/gemini.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [GeminiModule, QueueModule],
  controllers: [VendorsController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
