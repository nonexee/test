import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface ExtractionJobData {
  vendorId: string;
  tenantId: string;
  extractionJobId: string;
}

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('extraction') private extractionQueue: Queue<ExtractionJobData>,
  ) {}

  /**
   * Add an extraction job to the queue
   */
  async addExtractionJob(data: ExtractionJobData): Promise<void> {
    await this.extractionQueue.add(
      'extract-vendor-facts',
      data,
      {
        attempts: 3, // Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      },
    );
  }

  /**
   * Get the status of a job by ID
   */
  async getJobStatus(jobId: string) {
    const job = await this.extractionQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      state: await job.getState(),
      progress: job.progress,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    };
  }
}
