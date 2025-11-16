import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { QueueService } from '../queue/queue.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { VendorType, VendorCriticality, DocumentType, ExtractionJobStatus, Prisma } from '@prisma/client';

@Injectable()
export class VendorsService {
  constructor(
    private prisma: PrismaService,
    private geminiService: GeminiService,
    private queueService: QueueService,
  ) {}

  async findAll(
    tenantId: string,
    filters?: {
      type?: VendorType;
      criticality?: VendorCriticality;
      search?: string;
      includeFacts?: boolean;
    },
  ) {
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

    const vendors = await this.prisma.vendor.findMany({
      where,
      include: {
        facts: filters?.includeFacts
          ? true
          : {
              select: {
                vendorId: true,
              },
            },
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      type: vendor.type,
      criticality: vendor.criticality,
      status: vendor.status,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
      hasFacts: !!vendor.facts,
      documentCount: vendor._count.documents,
      ...(filters?.includeFacts && vendor.facts
        ? { facts: vendor.facts }
        : {}),
    }));
  }

  async findOne(id: string, tenantId: string) {
    // Use findFirst with compound WHERE for tenant isolation at query level
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
          take: 5,
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  async create(tenantId: string, dto: CreateVendorDto) {
    return this.prisma.vendor.create({
      data: {
        ...dto,
        tenantId,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateVendorDto) {
    // Update with compound WHERE clause for defense in depth
    const vendor = await this.prisma.vendor.updateMany({
      where: {
        id,
        tenantId, // CRITICAL: Ensures tenant isolation at query level
      },
      data: dto,
    });

    if (vendor.count === 0) {
      throw new NotFoundException('Vendor not found or access denied');
    }

    // Return the updated vendor
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string) {
    // Delete with compound WHERE clause for defense in depth
    const result = await this.prisma.vendor.deleteMany({
      where: {
        id,
        tenantId, // CRITICAL: Ensures tenant isolation at query level
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Vendor not found or access denied');
    }

    return { message: 'Vendor deleted successfully' };
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
      throw new NotFoundException('Tenant not found');
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

    // Automatically trigger extraction job when a new document is uploaded
    // Use try-catch to prevent extraction failures from blocking document upload
    try {
      await this.triggerExtraction(vendorId, tenantId);
    } catch (error) {
      // Log error but don't fail the upload
      // Document is saved successfully, extraction can be manually triggered
      this.logger.error(
        `Failed to auto-trigger extraction for vendor ${vendorId} after document upload`,
        error,
      );
      // Don't throw - document upload succeeded
    }

    return document;
  }

  /**
   * Manually trigger extraction for a vendor
   */
  async triggerExtraction(vendorId: string, tenantId: string) {
    // Verify vendor exists and belongs to tenant
    await this.findOne(vendorId, tenantId);

    // Create extraction job record
    const extractionJob = await this.prisma.extractionJob.create({
      data: {
        vendorId,
        status: ExtractionJobStatus.PENDING,
      },
    });

    // Add job to queue
    await this.queueService.addExtractionJob({
      vendorId,
      tenantId,
      extractionJobId: extractionJob.id,
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
      throw new NotFoundException('Tenant not found');
    }

    // Get supporting snippets from Gemini File Search
    return this.geminiService.getSupportingSnippets(
      tenant.geminiFileSearchStoreName,
      statement,
    );
  }
}
