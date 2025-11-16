import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { VendorType, VendorCriticality, DocumentType } from '@prisma/client';

@Injectable()
export class VendorsService {
  constructor(
    private prisma: PrismaService,
    private geminiService: GeminiService,
  ) {}

  async findAll(
    tenantId: string,
    filters?: {
      type?: VendorType;
      criticality?: VendorCriticality;
      search?: string;
    },
  ) {
    const where: any = { tenantId };

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
        facts: {
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
    }));
  }

  async findOne(id: string, tenantId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
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

    // Ensure vendor belongs to the tenant
    if (vendor.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
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
    // First check if vendor exists and belongs to tenant
    await this.findOne(id, tenantId);

    return this.prisma.vendor.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, tenantId: string) {
    // First check if vendor exists and belongs to tenant
    await this.findOne(id, tenantId);

    await this.prisma.vendor.delete({
      where: { id },
    });

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

    return document;
  }
}
