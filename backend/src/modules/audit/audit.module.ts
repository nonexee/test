import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from '../../common/services/audit.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * FIX GAP #2: Audit Module
 *
 * Provides audit logging API endpoints for compliance and security monitoring.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
