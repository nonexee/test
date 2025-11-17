import { Test, TestingModule } from '@nestjs/testing';
import { VendorsService } from './vendors.service';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { QueueService } from '../queue/queue.service';
import { AuditService } from '../../common/services/audit.service';
import { NotFoundException } from '@nestjs/common';
import { VendorType, VendorCriticality, VendorStatus, ExtractionJobStatus } from '@prisma/client';

describe('VendorsService', () => {
  let service: VendorsService;
  let prismaService: PrismaService;
  let geminiService: GeminiService;
  let queueService: QueueService;
  let auditService: AuditService;

  const mockPrismaService = {
    vendor: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    extractionJob: {
      count: jest.fn(),
      create: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    vendorDocument: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockGeminiService = {
    uploadFileToStore: jest.fn(),
    getSupportingSnippets: jest.fn(),
  };

  const mockQueueService = {
    addExtractionJob: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: GeminiService, useValue: mockGeminiService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<VendorsService>(VendorsService);
    prismaService = module.get<PrismaService>(PrismaService);
    geminiService = module.get<GeminiService>(GeminiService);
    queueService = module.get<QueueService>(QueueService);
    auditService = module.get<AuditService>(AuditService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all vendors for a tenant', async () => {
      const mockVendors = [
        {
          id: '1',
          name: 'Test Vendor',
          type: VendorType.SAAS,
          criticality: VendorCriticality.HIGH,
          status: VendorStatus.DRAFT,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { documents: 5, facts: 1 },
        },
      ];

      mockPrismaService.vendor.findMany.mockResolvedValue(mockVendors);

      const result = await service.findAll('tenant-1');

      expect(result).toHaveLength(1);
      expect(result[0].hasFacts).toBe(true);
      expect(result[0].documentCount).toBe(5);
      expect(mockPrismaService.vendor.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        include: expect.objectContaining({
          _count: expect.any(Object),
        }),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter vendors by type and criticality', async () => {
      mockPrismaService.vendor.findMany.mockResolvedValue([]);

      await service.findAll('tenant-1', {
        type: VendorType.SAAS,
        criticality: VendorCriticality.HIGH,
      });

      expect(mockPrismaService.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            type: VendorType.SAAS,
            criticality: VendorCriticality.HIGH,
          }),
        })
      );
    });

    it('should search vendors by name', async () => {
      mockPrismaService.vendor.findMany.mockResolvedValue([]);

      await service.findAll('tenant-1', { search: 'test' });

      expect(mockPrismaService.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'test', mode: 'insensitive' },
          }),
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return a vendor with extraction jobs pagination', async () => {
      const mockVendor = {
        id: '1',
        name: 'Test Vendor',
        type: VendorType.SAAS,
        criticality: VendorCriticality.HIGH,
        status: VendorStatus.DRAFT,
        tenantId: 'tenant-1',
        facts: null,
        documents: [],
        extractionJobs: [],
      };

      mockPrismaService.vendor.findFirst.mockResolvedValue(mockVendor);
      mockPrismaService.extractionJob.count.mockResolvedValue(25);

      const result = await service.findOne('1', 'tenant-1', { jobsPage: 2, jobsLimit: 10 });

      expect(result.extractionJobsMetadata).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
      expect(mockPrismaService.vendor.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1', tenantId: 'tenant-1' },
          include: expect.objectContaining({
            extractionJobs: expect.objectContaining({
              skip: 10,
              take: 10,
            }),
          }),
        })
      );
    });

    it('should throw NotFoundException if vendor not found', async () => {
      mockPrismaService.vendor.findFirst.mockResolvedValue(null);

      await expect(service.findOne('999', 'tenant-1')).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation in query', async () => {
      mockPrismaService.vendor.findFirst.mockResolvedValue(null);

      await expect(service.findOne('1', 'tenant-2')).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.vendor.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1', tenantId: 'tenant-2' },
        })
      );
    });
  });

  describe('create', () => {
    it('should create a vendor and log audit', async () => {
      const createDto = {
        name: 'New Vendor',
        type: VendorType.SAAS,
        criticality: VendorCriticality.MEDIUM,
      };

      const mockCreatedVendor = {
        id: '1',
        ...createDto,
        status: VendorStatus.DRAFT,
        tenantId: 'tenant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.vendor.create.mockResolvedValue(mockCreatedVendor);

      const result = await service.create('tenant-1', createDto, 'user-1');

      expect(result).toEqual(mockCreatedVendor);
      expect(mockPrismaService.vendor.create).toHaveBeenCalledWith({
        data: { ...createDto, tenantId: 'tenant-1' },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_VENDOR',
          tenantId: 'tenant-1',
          userId: 'user-1',
        })
      );
    });
  });

  describe('update', () => {
    it('should update a vendor and log audit', async () => {
      const mockVendor = {
        id: '1',
        name: 'Old Name',
        type: VendorType.SAAS,
        criticality: VendorCriticality.MEDIUM,
        status: VendorStatus.DRAFT,
        tenantId: 'tenant-1',
      };

      mockPrismaService.vendor.findFirst.mockResolvedValueOnce(mockVendor);
      mockPrismaService.vendor.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.vendor.findFirst.mockResolvedValueOnce({
        ...mockVendor,
        name: 'New Name',
      });
      mockPrismaService.extractionJob.count.mockResolvedValue(0);

      const updateDto = { name: 'New Name' };
      const result = await service.update('1', 'tenant-1', updateDto, 'user-1');

      expect(result.name).toBe('New Name');
      expect(mockPrismaService.vendor.updateMany).toHaveBeenCalledWith({
        where: { id: '1', tenantId: 'tenant-1' },
        data: updateDto,
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_VENDOR',
        })
      );
    });

    it('should throw NotFoundException if vendor not found on update', async () => {
      mockPrismaService.vendor.findFirst.mockResolvedValue(null);

      await expect(service.update('999', 'tenant-1', { name: 'Test' })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('delete', () => {
    it('should delete a vendor and log audit', async () => {
      const mockVendor = {
        id: '1',
        name: 'Test Vendor',
        type: VendorType.SAAS,
        criticality: VendorCriticality.HIGH,
      };

      mockPrismaService.vendor.findFirst.mockResolvedValue(mockVendor);
      mockPrismaService.extractionJob.count.mockResolvedValue(0);
      mockPrismaService.vendor.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.delete('1', 'tenant-1', 'user-1');

      expect(result.message).toBe('Vendor deleted successfully');
      expect(mockPrismaService.vendor.deleteMany).toHaveBeenCalledWith({
        where: { id: '1', tenantId: 'tenant-1' },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_VENDOR',
        })
      );
    });
  });

  describe('triggerExtraction', () => {
    it('should create extraction job in transaction', async () => {
      const mockVendor = {
        id: 'vendor-1',
        name: 'Test Vendor',
        tenantId: 'tenant-1',
      };

      const mockJob = {
        id: 'job-1',
        vendorId: 'vendor-1',
        tenantId: 'tenant-1',
        status: ExtractionJobStatus.PENDING,
      };

      mockPrismaService.vendor.findFirst.mockResolvedValue(mockVendor);
      mockPrismaService.extractionJob.count.mockResolvedValue(0);
      mockPrismaService.extractionJob.create.mockResolvedValue(mockJob);

      const result = await service.triggerExtraction('vendor-1', 'tenant-1', 'user-1');

      expect(result.id).toBe('job-1');
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockQueueService.addExtractionJob).toHaveBeenCalledWith({
        vendorId: 'vendor-1',
        tenantId: 'tenant-1',
        extractionJobId: 'job-1',
      });
    });
  });
});
