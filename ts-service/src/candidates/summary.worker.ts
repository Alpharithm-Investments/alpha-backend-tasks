import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import {
  SUMMARIZATION_PROVIDER,
  SummarizationProvider,
} from '../llm/summarization-provider.interface';
import { QueueService } from '../queue/queue.service';
import {
  CandidatesService,
  SUMMARY_JOB_NAME,
  SummaryJobPayload,
} from './candidates.service';

const PROMPT_VERSION = 'v1';

@Injectable()
export class SummaryWorker implements OnModuleInit {
  private readonly logger = new Logger(SummaryWorker.name);
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly queueService: QueueService,
    private readonly candidatesService: CandidatesService,
    @Inject(SUMMARIZATION_PROVIDER)
    private readonly summarizationProvider: SummarizationProvider,
  ) {}

  onModuleInit(): void {
    // Poll the in-memory queue every 500ms to pick up new jobs
    this.processingInterval = setInterval(() => {
      void this.drainQueue();
    }, 500);
  }

  private async drainQueue(): Promise<void> {
    // Guard against overlapping runs: setInterval fires every 500ms regardless
    // of whether the previous async cycle has finished.
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const jobs = this.queueService.getQueuedJobs().filter(
        (j) => j.name === SUMMARY_JOB_NAME,
      );

      for (const job of jobs) {
        await this.processJob(job.payload as SummaryJobPayload);
        this.queueService.markProcessed(job.id);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(payload: SummaryJobPayload): Promise<void> {
    const { summaryId, candidateId } = payload;
    this.logger.log(`Processing summary job ${summaryId} for candidate ${candidateId}`);

    try {
      const documents = await this.candidatesService.getDocumentsForCandidate(candidateId);
      const docTexts = documents.map((d) => d.rawText);

      const result = await this.summarizationProvider.generateCandidateSummary({
        candidateId,
        documents: docTexts,
      });

      // Validate structured output from provider
      if (
        typeof result.score !== 'number' ||
        !Array.isArray(result.strengths) ||
        !Array.isArray(result.concerns) ||
        typeof result.summary !== 'string' ||
        !['advance', 'hold', 'reject'].includes(result.recommendedDecision)
      ) {
        throw new Error('Provider returned malformed output');
      }

      await this.candidatesService.updateSummary(summaryId, {
        status: 'completed',
        score: result.score,
        strengths: result.strengths,
        concerns: result.concerns,
        summary: result.summary,
        recommendedDecision: result.recommendedDecision,
        provider: this.summarizationProvider.constructor.name,
        promptVersion: PROMPT_VERSION,
        errorMessage: null,
      });

      this.logger.log(`Summary ${summaryId} completed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Summary ${summaryId} failed: ${message}`);

      await this.candidatesService.updateSummary(summaryId, {
        status: 'failed',
        errorMessage: message,
      });
    }
  }
}
