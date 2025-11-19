import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { QueueService } from '../queue/queue.service';
import { AuditService } from '../../common/services/audit.service';
import { ErrorMessages } from '../../common/constants/error-messages';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { VendorType, VendorCriticality, DocumentType, ExtractionJobStatus, Prisma } from '@prisma/client';

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    private prisma: PrismaService,
    private geminiService: GeminiService,
    private queueService: QueueService,
    private auditService: AuditService,
  ) {}

  async findAll(
    tenantId: string,
    filters?: {
      type?: VendorType;
      criticality?: VendorCriticality;
      search?: string;
      includeFacts?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    // Pagination parameters with defaults
    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit ?? 50, 100); // Max 100 items per page
    const skip = (page - 1) * limit;

    const where: Prisma.VendorWhereInput = { tenantId };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.criticality) {
      where.criticality = filters.criticality;
    }

    if (filters?.search) {
      where.name = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }

    // Execute queries in parallel for better performance
    const [vendors, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        include: {
          // Only include full facts when explicitly requested (LOW #40 fix)
          ...(filters?.includeFacts && { facts: true }),
          _count: {
            select: {
              documents: true,
              // Count facts to check existence without loading data
              facts: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.vendor.count({ where }),
    ]);

    const mappedVendors = vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      type: vendor.type,
      criticality: vendor.criticality,
      status: vendor.status,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
      hasFacts: vendor._count.facts > 0,
      documentCount: vendor._count.documents,
      ...(filters?.includeFacts && vendor.facts
        ? { facts: vendor.facts }
        : {}),
    }));

    return {
      vendors: mappedVendors,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }

  async findOne(id: string, tenantId: string, options?: { jobsPage?: number; jobsLimit?: number }) {
    // Use findFirst with compound WHERE for tenant isolation at query level
    const jobsPage = options?.jobsPage ?? 1;
    const jobsLimit = options?.jobsLimit ?? 10;
    const jobsSkip = (jobsPage - 1) * jobsLimit;

    const vendor = await this.prisma.vendor.findFirst({
      where: {
        id,
        tenantId, // CRITICAL: Tenant isolation enforced in query
      },
      include: {
        facts: true,
        documents: {
          orderBy: {
            uploadedAt: 'desc',
          },
        },
        extractionJobs: {
          orderBy: {
            createdAt: 'desc',
          },
          skip: jobsSkip,
          take: jobsLimit,
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException(ErrorMessages.VENDOR.NOT_FOUND);
    }

    // Get total count of extraction jobs for pagination
    const totalJobs = await this.prisma.extractionJob.count({
      where: {
        vendorId: id,
        tenantId,
      },
    });

    return {
      ...vendor,
      extractionJobsMetadata: {
        total: totalJobs,
        page: jobsPage,
        limit: jobsLimit,
        totalPages: Math.ceil(totalJobs / jobsLimit),
      },
    };
  }

  async create(tenantId: string, dto: CreateVendorDto, userId?: string) {
    const vendor = await this.prisma.vendor.create({
      data: {
        ...dto,
        tenantId,
      },
    });

    this.logger.log(
      `Vendor created: ${vendor.id} (${vendor.name}) for tenant ${tenantId}`,
    );

    // Audit log (MEDIUM #20)
    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE_VENDOR',
      resource: 'VENDOR',
      resourceId: vendor.id,
      metadata: {
        vendorName: vendor.name,
        type: vendor.type,
        criticality: vendor.criticality,
      },
    });

    return vendor;
  }

  async update(id: string, tenantId: string, dto: UpdateVendorDto, userId?: string) {
    // Get vendor before update for audit trail
    const vendorBefore = await this.findOne(id, tenantId);

    // Update with compound WHERE clause for defense in depth
    const vendor = await this.prisma.vendor.updateMany({
      where: {
        id,
        tenantId, // CRITICAL: Ensures tenant isolation at query level
      },
      data: dto,
    });

    if (vendor.count === 0) {
      throw new NotFoundException(ErrorMessages.VENDOR.NOT_FOUND_OR_ACCESS_DENIED);
    }

    this.logger.log(
      `Vendor updated: ${id} for tenant ${tenantId}`,
    );

    // Audit log (MEDIUM #20)
    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE_VENDOR',
      resource: 'VENDOR',
      resourceId: id,
      metadata: {
        vendorName: vendorBefore.name,
        changes: dto,
      },
    });

    // Return the updated vendor
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string, userId?: string): Promise<void> {
    // Get vendor before deletion for audit trail
    const vendor = await this.findOne(id, tenantId);

    // Delete with compound WHERE clause for defense in depth
    const result = await this.prisma.vendor.deleteMany({
      where: {
        id,
        tenantId, // CRITICAL: Ensures tenant isolation at query level
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(ErrorMessages.VENDOR.NOT_FOUND_OR_ACCESS_DENIED);
    }

    this.logger.warn(
      `Vendor deleted: ${id} for tenant ${tenantId}`,
    );

    // Audit log (MEDIUM #20)
    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE_VENDOR',
      resource: 'VENDOR',
      resourceId: id,
      metadata: {
        vendorName: vendor.name,
        type: vendor.type,
        criticality: vendor.criticality,
      },
    });

    // FIX GAP #5: Return void for 204 No Content
  }

  async uploadDocument(
    vendorId: string,
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
    dto: UploadDocumentDto,
  ) {
    // First check if vendor exists and belongs to tenant
    const vendor = await this.findOne(vendorId, tenantId);

    // Get tenant's Gemini store name
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(ErrorMessages.TENANT.NOT_FOUND);
    }

    // Upload file to Gemini File Search
    const geminiFileNameOrId = await this.geminiService.uploadFileToStore(
      tenant.geminiFileSearchStoreName,
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Save document record
    const document = await this.prisma.vendorDocument.create({
      data: {
        fileName: file.originalname,
        fileType: dto.fileType,
        geminiFileNameOrId,
        vendorId,
        uploadedByUserId: userId,
      },
    });

    this.logger.log(
      `Document uploaded: ${document.id} (${file.originalname}) for vendor ${vendorId}`,
    );

    // Audit log (MEDIUM #20)
    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPLOAD_DOCUMENT',
      resource: 'DOCUMENT',
      resourceId: document.id,
      metadata: {
        vendorId,
        vendorName: vendor.name,
        fileName: file.originalname,
        fileType: dto.fileType,
        fileSize: file.size,
      },
    });

    // Automatically trigger extraction job when a new document is uploaded
    // Use try-catch to prevent extraction failures from blocking document upload
    try {
      await this.triggerExtraction(vendorId, tenantId, userId);
    } catch (error) {
      // Log error but don't fail the upload
      // Document is saved successfully, extraction can be manually triggered
      // Only log error message to avoid exposing sensitive data
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to auto-trigger extraction for vendor ${vendorId} after document upload: ${errorMessage}`
      );
      // Don't throw - document upload succeeded
    }

    return document;
  }

  /**
   * FIX GAP #3: Delete document endpoint
   * Delete a document with proper tenant isolation
   */
  async deleteDocument(
    documentId: string,
    vendorId: string,
    tenantId: string,
    userId?: string,
  ): Promise<void> {
    // First verify vendor exists and belongs to tenant
    const vendor = await this.findOne(vendorId, tenantId);

    // Find the document with compound WHERE for tenant isolation
    const document = await this.prisma.vendorDocument.findFirst({
      where: {
        id: documentId,
        vendorId,
        vendor: {
          tenantId, // Ensures tenant isolation
        },
      },
    });

    if (!document) {
      throw new NotFoundException(ErrorMessages.DOCUMENT.NOT_FOUND_OR_ACCESS_DENIED);
    }

    // Delete document from database
    // Cascading is not needed as documents don't have child relations
    await this.prisma.vendorDocument.delete({
      where: { id: documentId },
    });

    // FIX GAP #17: Delete file from Gemini File Search (stub implementation)
    // Note: Actual deletion from Gemini not yet supported by API
    // This call logs the deletion attempt for when the API becomes available
    await this.geminiService.deleteFileFromStore(
      tenant.geminiFileSearchStoreName,
      document.geminiFileNameOrId
    );

    this.logger.log(
      `Document deleted: ${documentId} (${document.fileName}) from vendor ${vendorId}`,
    );

    // Audit log
    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE_DOCUMENT',
      resource: 'DOCUMENT',
      resourceId: documentId,
      metadata: {
        vendorId,
        vendorName: vendor.name,
        fileName: document.fileName,
        fileType: document.fileType,
      },
    });
  }

  /**
   * Manually trigger extraction for a vendor
   */
  async triggerExtraction(vendorId: string, tenantId: string, userId?: string) {
    // Verify vendor exists and belongs to tenant
    const vendor = await this.findOne(vendorId, tenantId);

    // Use transaction to ensure atomicity between job creation and queue addition
    // Fixes MEDIUM #19: No transaction in extraction job creation
    const extractionJob = await this.prisma.$transaction(async (tx) => {
      // Create extraction job record with tenantId for proper isolation
      // Fixes HIGH #6: No tenant isolation on ExtractionJob queries
      const job = await tx.extractionJob.create({
        data: {
          vendorId,
          tenantId, // Now includes tenantId for efficient tenant-scoped queries
          status: ExtractionJobStatus.PENDING,
        },
      });

      // Add job to queue (if this fails, transaction rolls back)
      await this.queueService.addExtractionJob({
        vendorId,
        tenantId,
        extractionJobId: job.id,
      });

      return job;
    });

    this.logger.log(
      `Extraction job created: ${extractionJob.id} for vendor ${vendorId}, tenant ${tenantId}`,
    );

    // Audit log (MEDIUM #20)
    await this.auditService.log({
      tenantId,
      userId,
      action: 'TRIGGER_EXTRACTION',
      resource: 'EXTRACTION_JOB',
      resourceId: extractionJob.id,
      metadata: {
        vendorId,
        vendorName: vendor.name,
        jobStatus: extractionJob.status,
      },
    });

    return extractionJob;
  }

  /**
   * Get supporting snippets for a given statement/field
   */
  async getSupportingSnippets(vendorId: string, tenantId: string, statement: string) {
    // Verify vendor exists and belongs to tenant
    const vendor = await this.findOne(vendorId, tenantId);

    // Get tenant's Gemini store name
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(ErrorMessages.TENANT.NOT_FOUND);
    }

    // Get supporting snippets from Gemini File Search
    return this.geminiService.getSupportingSnippets(
      tenant.geminiFileSearchStoreName,
      statement,
    );
  }
}
