import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface AuditLogData {
  tenantId: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Log an audit event for compliance and security tracking
   * Implements MEDIUM #20: Audit logging for all mutations
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: data.tenantId,
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          metadata: data.metadata,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });

      this.logger.log(
        `Audit: [${data.action}] ${data.resource}${data.resourceId ? ` (${data.resourceId})` : ''} by user ${data.userId || 'system'} in tenant ${data.tenantId}`
      );
    } catch (error) {
      // Don't fail the operation if audit logging fails
      // But log the error for monitoring
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create audit log: ${errorMessage}`);
    }
  }

  /**
   * Query audit logs for a tenant with pagination support
   * E2E FIX: Returns both logs and total count for proper pagination
   */
  async findByTenant(
    tenantId: string,
    options?: {
      userId?: string;
      action?: string;
      resource?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: Prisma.AuditLogWhereInput = { tenantId };

    if (options?.userId) where.userId = options.userId;
    if (options?.action) where.action = options.action;
    if (options?.resource) where.resource = options.resource;

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 100,
        skip: options?.offset || 0,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Get audit statistics for a tenant
   * E2E FIX: Includes time-based counts (today, this week, this month)
   */
  async getStatistics(tenantId: string, startDate?: Date, endDate?: Date) {
    const where: Prisma.AuditLogWhereInput = { tenantId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // Get time boundaries for time-based statistics
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setMonth(now.getMonth() - 1);

    const [
      totalActions,
      actionsToday,
      actionsThisWeek,
      actionsThisMonth,
      actionBreakdown,
      resourceBreakdown,
    ] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.count({
        where: { tenantId, createdAt: { gte: todayStart } },
      }),
      this.prisma.auditLog.count({
        where: { tenantId, createdAt: { gte: weekStart } },
      }),
      this.prisma.auditLog.count({
        where: { tenantId, createdAt: { gte: monthStart } },
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: true,
      }),
      this.prisma.auditLog.groupBy({
        by: ['resource'],
        where,
        _count: true,
      }),
    ]);

    return {
      totalActions,
      actionsToday,
      actionsThisWeek,
      actionsThisMonth,
      actionBreakdown: actionBreakdown.map((item) => ({
        action: item.action,
        count: item._count,
      })),
      resourceBreakdown: resourceBreakdown.map((item) => ({
        resource: item.resource,
        count: item._count,
      })),
    };
  }
}
