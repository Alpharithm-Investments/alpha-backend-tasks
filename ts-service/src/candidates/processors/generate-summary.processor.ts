import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateDocument } from '../../entities/candidate-document.entity';
import { CandidateSummary } from '../../entities/candidate-summary.entity';
import {
  SummarizationProvider,
  SUMMARIZATION_PROVIDER,
} from '../../llm/summarization-provider.interface';
import { QueueService } from '../../queue/queue.service';

interface GenerateSummaryJob {
  summaryId: string;
  candidateId: string;
  candidateName: string;
}

@Injectable()
export class GenerateSummaryProcessor {
  private readonly logger = new Logger(GenerateSummaryProcessor.name);

  constructor(
    @InjectRepository(CandidateSummary)
    private summaryRepo: Repository<CandidateSummary>,
    @InjectRepository(CandidateDocument)
    private documentRepo: Repository<CandidateDocument>,
    @Inject(SUMMARIZATION_PROVIDER)
    private summarizationProvider: SummarizationProvider,
    private queueService: QueueService,
  ) {
    this.registerHandler();
  }

  private registerHandler(): void {
    this.queueService.enqueue('generate-summary', this.handleJob.bind(this));
  }

  private async handleJob(job: GenerateSummaryJob): Promise<void> {
    this.logger.log(`Processing summary generation for candidate ${job.candidateId}`);

    const summary = await this.summaryRepo.findOne({
      where: { id: job.summaryId },
    });

    if (!summary) {
      this.logger.error(`Summary ${job.summaryId} not found`);
      return;
    }

    try {
      // Fetch candidate documents
      const documents = await this.documentRepo.find({
        where: { candidateId: job.candidateId },
        order: { uploadedAt: 'DESC' },
      });

      if (documents.length === 0) {
        throw new Error('No documents found for candidate');
      }

      // Prepare documents for LLM (just raw text array)
      const docsText = documents.map((d) => (d.rawText ?? '').substring(0, 10000));
      // Call LLM provider with correct interface
      const result = await this.summarizationProvider.generateCandidateSummary({
        candidateId: job.candidateId,
        documents: docsText,
      });

      // Map RecommendedDecision to entity format
      const decisionMap: Record<string, 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no'> = {
        advance: 'strong_yes',
        hold: 'maybe',
        reject: 'no',
      };

      // Update summary with results
      summary.status = 'completed';
      summary.score = result.score;
      summary.strengths = result.strengths;
      summary.concerns = result.concerns;
      summary.summary = result.summary;
      summary.recommendedDecision = decisionMap[result.recommendedDecision] || 'maybe';
      summary.provider = 'gemini';
      summary.promptVersion = 'default';
      summary.errorMessage = null;

      await this.summaryRepo.save(summary);

      this.logger.log(`Successfully generated summary ${job.summaryId}`);
    } catch (error) {
      this.logger.error(`Failed to generate summary: ${error}`);

      summary.status = 'failed';
    //   summary.errorMessage = error.message;
      await this.summaryRepo.save(summary);
    }
  }
}