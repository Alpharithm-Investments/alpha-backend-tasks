import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';

export interface EnqueuedJob<TPayload = unknown> {
  id: string;
  name: string;
  payload: TPayload;
  enqueuedAt: string;
  processed: boolean;
}

@Injectable()
export class QueueService {
  private readonly jobs: EnqueuedJob[] = [];

  enqueue<TPayload>(name: string, payload: TPayload): EnqueuedJob<TPayload> {
    const job: EnqueuedJob<TPayload> = {
      id: randomUUID(),
      name,
      payload,
      enqueuedAt: new Date().toISOString(),
      processed: false,
    };

    this.jobs.push(job);
    return job;
  }

  getQueuedJobs(): readonly EnqueuedJob[] {
    return this.jobs.filter((j) => !j.processed);
  }

  markProcessed(jobId: string): void {
    const job = this.jobs.find((j) => j.id === jobId);
    if (job) {
      job.processed = true;
    }
  }

  /** Returns all jobs (including processed) — useful for testing. */
  getAllJobs(): readonly EnqueuedJob[] {
    return this.jobs;
  }
}
