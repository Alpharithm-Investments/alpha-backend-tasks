import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Inject } from "@nestjs/common";
import { Repository } from "typeorm";

import { CandidateDocument } from "../entities/candidate-document.entity";
import {
  CandidateSummary,
  RecommendedDecision,
  SummaryStatus,
} from "../entities/candidate-summary.entity";
import {
  CandidateSummaryResult,
  SummarizationProvider,
  SUMMARIZATION_PROVIDER,
} from "../llm/summarization-provider.interface";
import { QueueService, EnqueuedJob } from "./queue.service";
import { GENERATE_SUMMARY_JOB, GenerateSummaryJobPayload } from "./queue.types";

@Injectable()
export class QueueWorkerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(QueueWorkerService.name);
  private isRunning = false;

  constructor(
    private readonly queueService: QueueService,
    @InjectRepository(CandidateDocument)
    private readonly documentRepository: Repository<CandidateDocument>,
    @InjectRepository(CandidateSummary)
    private readonly summaryRepository: Repository<CandidateSummary>,
    @Inject(SUMMARIZATION_PROVIDER)
    private readonly summaryProvider: SummarizationProvider,
  ) {}

  /**
   * Start the worker loop on application bootstrap.
   * Polls the queue every 2 seconds for pending jobs.
   */
  async onApplicationBootstrap(): Promise<void> {
    this.startWorker();
  }

  private startWorker(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.logger.log("QueueWorker started");

    // poll queue every 2 seconds
    setInterval(() => {
      this.processPendingJobs();
    }, 2000);
  }

  private async processPendingJobs(): Promise<void> {
    const jobs = this.queueService.getQueuedJobs();

    // filter jobs for summary generation
    const summaryJobs = jobs.filter((j) => j.name === GENERATE_SUMMARY_JOB);

    for (const job of summaryJobs) {
      try {
        await this.processJob(job as EnqueuedJob<GenerateSummaryJobPayload>);
        // remove from queue after successful processing
        this.queueService.removeJob(job.id);
      } catch (error) {
        this.logger.error(`Job ${job.id} failed:`, error);
        // optionally: track failed jobs or retry logic
      }
    }
  }

  private async processJob(
    job: EnqueuedJob<GenerateSummaryJobPayload>,
  ): Promise<void> {
    const { summaryId, candidateId } = job.payload;

    try {
      // fetch summary
      const summary = await this.summaryRepository.findOne({
        where: { id: summaryId },
      });
      if (!summary) {
        this.logger.warn(`Summary ${summaryId} not found`);
        return;
      }

      // fetch documents for candidate
      const documents = await this.documentRepository.find({
        where: { candidateId },
      });

      if (documents.length === 0) {
        // no documents to summarize
        await this.summaryRepository.update(summaryId, {
          status: SummaryStatus.FAILED,
          errorMessage: "No documents found for candidate",
          completedAt: new Date(),
        });
        return;
      }

      // call llm provider
      const result = await this.summaryProvider.generateCandidateSummary({
        candidateId,
        documents: documents.map((d) => d.rawText),
      });

      // persist results
      await this.summaryRepository.update(summaryId, {
        status: SummaryStatus.COMPLETED,
        score: result.score,
        strengths: JSON.stringify(result.strengths),
        concerns: JSON.stringify(result.concerns),
        summary: result.summary,
        recommendedDecision: result.recommendedDecision as RecommendedDecision,
        provider: "mock", // will be set by actual provider
        promptVersion: "v1",
        completedAt: new Date(),
      });

      this.logger.log(`Summary ${summaryId} completed successfully`);
    } catch (error) {
      this.logger.error(`Error processing job ${job.id}:`, error);
      // mark summary as failed
      await this.summaryRepository.update(summaryId, {
        status: SummaryStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      });
    }
  }
}
