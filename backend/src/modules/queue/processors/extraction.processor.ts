import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExtractionJobStatus } from '@prisma/client';
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
      // Update job status to RUNNING
      await this.prisma.extractionJob.update({
        where: { id: extractionJobId },
        data: {
          status: ExtractionJobStatus.RUNNING,
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

      // Save extracted facts to database (map snake_case to camelCase)
      const factsData = {
        dataCategories: extractedFacts.data_categories,
        regions: extractedFacts.regions,
        subProcessors: extractedFacts.sub_processors,
        servicesSupported: extractedFacts.services_supported,
        businessFunctions: extractedFacts.business_functions,
        securityHighlights: extractedFacts.security_highlights,
        impactIfCompromised: extractedFacts.impact_if_compromised.toUpperCase(),
        regulatoryRelevance: extractedFacts.regulatory_relevance,
        lastExtractionAt: new Date(),
      };

      await this.prisma.vendorFacts.upsert({
        where: { vendorId: vendor.id },
        update: factsData,
        create: {
          ...factsData,
          vendorId: vendor.id,
        },
      });

      await job.updateProgress(90);

      // Update extraction job status to SUCCESS
      await this.prisma.extractionJob.update({
        where: { id: extractionJobId },
        data: {
          status: ExtractionJobStatus.SUCCESS,
          finishedAt: new Date(),
          rawLlmOutput: JSON.parse(JSON.stringify(extractedFacts)),
        },
      });

      await job.updateProgress(100);

      this.logger.log(`Successfully completed extraction job ${extractionJobId}`);
    } catch (error) {
      this.logger.error(`Extraction job ${extractionJobId} failed:`, error);

      // Update extraction job status to ERROR
      await this.prisma.extractionJob.update({
        where: { id: extractionJobId },
        data: {
          status: ExtractionJobStatus.ERROR,
          finishedAt: new Date(),
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error occurred',
        },
      });

      throw error; // Re-throw to mark the Bull job as failed
    }
  }
}
