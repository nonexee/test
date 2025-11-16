import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiService } from '../../gemini/gemini.service';
import { ExtractionJobData } from '../queue.service';

@Processor('extraction')
export class ExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(ExtractionProcessor.name);

  constructor(
    private prisma: PrismaService,
    private geminiService: GeminiService,
  ) {
    super();
  }

  async process(job: Job<ExtractionJobData>): Promise<void> {
    const { vendorId, tenantId, extractionJobId } = job.data;

    this.logger.log(`Starting extraction job ${extractionJobId} for vendor ${vendorId}`);

    try {
      // Update job status to PROCESSING
      await this.prisma.extractionJob.update({
        where: { id: extractionJobId },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      });

      // Get vendor and all documents
      const vendor = await this.prisma.vendor.findFirst({
        where: {
          id: vendorId,
          tenantId,
        },
        include: {
          documents: true,
          tenant: true,
        },
      });

      if (!vendor) {
        throw new Error('Vendor not found or access denied');
      }

      // Update job progress
      await job.updateProgress(10);

      // Extract facts using Gemini
      this.logger.log(`Extracting facts for vendor ${vendor.name}`);
      const extractedFacts = await this.geminiService.extractVendorFacts(
        vendor.id,
        vendor.tenant.geminiFileSearchStoreName,
      );

      await job.updateProgress(80);

      // Save extracted facts to database
      await this.prisma.vendorFacts.upsert({
        where: { vendorId: vendor.id },
        update: {
          ...extractedFacts,
          lastExtractedAt: new Date(),
        },
        create: {
          ...extractedFacts,
          vendorId: vendor.id,
          lastExtractedAt: new Date(),
        },
      });

      await job.updateProgress(90);

      // Update extraction job status to COMPLETED
      await this.prisma.extractionJob.update({
        where: { id: extractionJobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: extractedFacts as Record<string, unknown>,
        },
      });

      await job.updateProgress(100);

      this.logger.log(`Successfully completed extraction job ${extractionJobId}`);
    } catch (error) {
      this.logger.error(`Extraction job ${extractionJobId} failed:`, error);

      // Update extraction job status to FAILED
      await this.prisma.extractionJob.update({
        where: { id: extractionJobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error occurred',
        },
      });

      throw error; // Re-throw to mark the Bull job as failed
    }
  }
}
