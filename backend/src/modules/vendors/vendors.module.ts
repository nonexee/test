import { Module } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { GeminiModule } from '../gemini/gemini.module';
import { QueueModule } from '../queue/queue.module';
import { AuditService } from '../../common/services/audit.service';

@Module({
  imports: [GeminiModule, QueueModule],
  controllers: [VendorsController],
  providers: [VendorsService, AuditService],
  exports: [VendorsService],
})
export class VendorsModule {}
