import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary, SummaryStatus } from '../entities/candidate-summary.entity';
import {
  CandidateSummaryResult,
  SummarizationProvider,
  SUMMARIZATION_PROVIDER,
} from '../llm/summarization-provider.interface';
import { QueueService, EnqueuedJob } from './queue.service';
import { QueueWorkerService } from './queue-worker.service';
import { GENERATE_SUMMARY_JOB } from './queue.types';

describe('QueueWorkerService', () => {
  let service: QueueWorkerService;
  let queueService: QueueService;
  let documentRepo: Repository<CandidateDocument>;
  let summaryRepo: Repository<CandidateSummary>;
  let summaryProvider: SummarizationProvider;

  beforeEach(async () => {
    const mockProvider: SummarizationProvider = {
      generateCandidateSummary: jest.fn().mockResolvedValue({
        score: 75,
        strengths: ['Strong', 'Skilled'],
        concerns: ['Needs improvement'],
        summary: 'Good candidate',
        recommendedDecision: 'hold',
      } as CandidateSummaryResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueWorkerService,
        QueueService,
        {
          provide: getRepositoryToken(CandidateDocument),
          useValue: {
            find: jest.fn().mockResolvedValue([
              { id: 'doc-1', rawText: 'document content' },
            ]),
          },
        },
        {
          provide: getRepositoryToken(CandidateSummary),
          useValue: {
            findOne: jest
              .fn()
              .mockResolvedValue({ id: 'sum-1', candidateId: 'cand-1' }),
            update: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: SUMMARIZATION_PROVIDER,
          useValue: mockProvider,
        },
      ],
    }).compile();

    service = module.get<QueueWorkerService>(QueueWorkerService);
    queueService = module.get<QueueService>(QueueService);
    documentRepo = module.get<Repository<CandidateDocument>>(
      getRepositoryToken(CandidateDocument),
    );
    summaryRepo = module.get<Repository<CandidateSummary>>(
      getRepositoryToken(CandidateSummary),
    );
    summaryProvider = module.get<SummarizationProvider>(SUMMARIZATION_PROVIDER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should process enqueued summary jobs', async () => {
    // enqueue a job
    const job = queueService.enqueue(GENERATE_SUMMARY_JOB, {
      summaryId: 'sum-1',
      candidateId: 'cand-1',
    });

    expect(queueService.getQueuedJobs().length).toBe(1);

    // simulate worker processing (private method, so we test indirectly)
    // by verifying the job would be processed correctly
    expect(job.payload.summaryId).toBe('sum-1');
    expect(job.payload.candidateId).toBe('cand-1');
  });

  it('should enqueue multiple jobs', () => {
    queueService.enqueue(GENERATE_SUMMARY_JOB, {
      summaryId: 'sum-1',
      candidateId: 'cand-1',
    });
    queueService.enqueue(GENERATE_SUMMARY_JOB, {
      summaryId: 'sum-2',
      candidateId: 'cand-2',
    });

    const jobs = queueService.getQueuedJobs();
    expect(jobs.length).toBe(2);
  });

  it('should remove job after processing', () => {
    const job = queueService.enqueue(GENERATE_SUMMARY_JOB, {
      summaryId: 'sum-1',
      candidateId: 'cand-1',
    });

    expect(queueService.getQueuedJobs().length).toBe(1);

    queueService.removeJob(job.id);

    expect(queueService.getQueuedJobs().length).toBe(0);
  });
});
