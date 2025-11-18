import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService } from '../../common/services/audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

/**
 * FIX GAP #2: Audit Logs API
 *
 * Provides endpoints to query audit logs for compliance and security monitoring.
 * All queries are automatically filtered by the user's tenant for security.
 */
@ApiTags('audit')
@ApiBearerAuth('JWT-auth')
@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('logs')
  @Throttle({ default: { limit: 50, ttl: 60000 } }) // 50 requests per minute
  @ApiOperation({
    summary: 'Get audit logs',
    description: 'Retrieve audit logs for the authenticated user\'s tenant with optional filtering',
  })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'Filter by user ID' })
  @ApiQuery({ name: 'action', required: false, type: String, description: 'Filter by action type (e.g., CREATE_VENDOR, DELETE_DOCUMENT)' })
  @ApiQuery({ name: 'resource', required: false, type: String, description: 'Filter by resource type (e.g., VENDOR, DOCUMENT)' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter logs after this date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter logs before this date (ISO 8601)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of logs to return (default: 100, max: 1000)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of logs to skip for pagination (default: 0)' })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          action: { type: 'string' },
          resource: { type: 'string' },
          resourceId: { type: 'string' },
          createdAt: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              role: { type: 'string' },
            },
          },
          metadata: { type: 'object' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getLogs(
    @CurrentUser() user: CurrentUserData,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    // Enforce max limit
    const sanitizedLimit = limit ? Math.min(limit, 1000) : 100;

    return this.auditService.findByTenant(user.tenantId, {
      userId,
      action,
      resource,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: sanitizedLimit,
      offset: offset || 0,
    });
  }

  @Get('statistics')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  @ApiOperation({
    summary: 'Get audit statistics',
    description: 'Get aggregated statistics about audit logs for the tenant',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Statistics after this date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Statistics before this date (ISO 8601)' })
  @ApiResponse({
    status: 200,
    description: 'Audit statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalActions: { type: 'number' },
        actionBreakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
        resourceBreakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              resource: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getStatistics(
    @CurrentUser() user: CurrentUserData,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getStatistics(
      user.tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
