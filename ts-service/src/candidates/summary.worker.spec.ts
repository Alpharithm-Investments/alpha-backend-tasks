import { Test, TestingModule } from '@nestjs/testing';

import { SUMMARIZATION_PROVIDER } from '../llm/summarization-provider.interface';
import { EnqueuedJob, QueueService } from '../queue/queue.service';
import { CandidatesService, SUMMARY_JOB_NAME } from './candidates.service';
import { SummaryWorker } from './summary.worker';

const makeJob = (summaryId: string, candidateId: string) => ({
  id: `job-${summaryId}`,
  name: SUMMARY_JOB_NAME,
  payload: { summaryId, candidateId },
  enqueuedAt: new Date().toISOString(),
  processed: false,
});

describe('SummaryWorker', () => {
  let worker: SummaryWorker;

  const queueService = {
    getQueuedJobs: jest.fn<readonly EnqueuedJob[], []>(() => []),
    markProcessed: jest.fn(),
  };

  const candidatesService = {
    getDocumentsForCandidate: jest.fn(),
    updateSummary: jest.fn(),
  };

  const summarizationProvider = {
    generateCandidateSummary: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummaryWorker,
        { provide: QueueService, useValue: queueService },
        { provide: CandidatesService, useValue: candidatesService },
        { provide: SUMMARIZATION_PROVIDER, useValue: summarizationProvider },
      ],
    }).compile();

    worker = module.get<SummaryWorker>(SummaryWorker);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('processes a queued job and marks summary as completed', async () => {
    const job = makeJob('sum-1', 'cand-1');
    queueService.getQueuedJobs.mockReturnValue([job]);
    candidatesService.getDocumentsForCandidate.mockResolvedValue([
      { rawText: 'Resume content here' },
    ]);
    summarizationProvider.generateCandidateSummary.mockResolvedValue({
      score: 85,
      strengths: ['Strong communication'],
      concerns: ['Limited leadership experience'],
      summary: 'A solid candidate with good technical skills.',
      recommendedDecision: 'advance',
    });

    // Trigger one drain cycle manually (bypasses the interval timer)
    await (worker as any).drainQueue();

    expect(candidatesService.getDocumentsForCandidate).toHaveBeenCalledWith('cand-1');
    expect(summarizationProvider.generateCandidateSummary).toHaveBeenCalledWith({
      candidateId: 'cand-1',
      documents: ['Resume content here'],
    });
    expect(candidatesService.updateSummary).toHaveBeenCalledWith(
      'sum-1',
      expect.objectContaining({
        status: 'completed',
        score: 85,
        strengths: ['Strong communication'],
        concerns: ['Limited leadership experience'],
        summary: 'A solid candidate with good technical skills.',
        recommendedDecision: 'advance',
      }),
    );
    expect(queueService.markProcessed).toHaveBeenCalledWith(job.id);
  });

  it('passes all document rawTexts to the provider', async () => {
    const job = makeJob('sum-2', 'cand-2');
    queueService.getQueuedJobs.mockReturnValue([job]);
    candidatesService.getDocumentsForCandidate.mockResolvedValue([
      { rawText: 'Resume text' },
      { rawText: 'Cover letter text' },
    ]);
    summarizationProvider.generateCandidateSummary.mockResolvedValue({
      score: 70,
      strengths: ['Good background'],
      concerns: [],
      summary: 'Decent candidate.',
      recommendedDecision: 'hold',
    });

    await (worker as any).drainQueue();

    expect(summarizationProvider.generateCandidateSummary).toHaveBeenCalledWith({
      candidateId: 'cand-2',
      documents: ['Resume text', 'Cover letter text'],
    });
  });

  // ── Failure handling ───────────────────────────────────────────────────────

  it('marks summary as failed when provider throws', async () => {
    const job = makeJob('sum-3', 'cand-3');
    queueService.getQueuedJobs.mockReturnValue([job]);
    candidatesService.getDocumentsForCandidate.mockResolvedValue([{ rawText: 'text' }]);
    summarizationProvider.generateCandidateSummary.mockRejectedValue(
      new Error('Gemini API error 429: quota exceeded'),
    );

    await (worker as any).drainQueue();

    expect(candidatesService.updateSummary).toHaveBeenCalledWith(
      'sum-3',
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'Gemini API error 429: quota exceeded',
      }),
    );
    // Job is still marked processed so it is not retried indefinitely
    expect(queueService.markProcessed).toHaveBeenCalledWith(job.id);
  });

  it('marks summary as failed when provider returns malformed output', async () => {
    const job = makeJob('sum-4', 'cand-4');
    queueService.getQueuedJobs.mockReturnValue([job]);
    candidatesService.getDocumentsForCandidate.mockResolvedValue([{ rawText: 'text' }]);
    summarizationProvider.generateCandidateSummary.mockResolvedValue({
      // missing score, strengths is not an array
      score: 'not-a-number',
      strengths: 'should be array',
      concerns: [],
      summary: 'ok',
      recommendedDecision: 'advance',
    });

    await (worker as any).drainQueue();

    expect(candidatesService.updateSummary).toHaveBeenCalledWith(
      'sum-4',
      expect.objectContaining({ status: 'failed' }),
    );
  });

  // ── Queue filtering ────────────────────────────────────────────────────────

  it('ignores jobs with a different name', async () => {
    queueService.getQueuedJobs.mockReturnValue([
      { id: 'j1', name: 'some-other-job', payload: {}, enqueuedAt: new Date().toISOString(), processed: false },
    ]);

    await (worker as any).drainQueue();

    expect(summarizationProvider.generateCandidateSummary).not.toHaveBeenCalled();
    expect(queueService.markProcessed).not.toHaveBeenCalled();
  });

  it('does nothing when the queue is empty', async () => {
    queueService.getQueuedJobs.mockReturnValue([]);

    await (worker as any).drainQueue();

    expect(summarizationProvider.generateCandidateSummary).not.toHaveBeenCalled();
  });

  // ── Concurrency guard ──────────────────────────────────────────────────────

  it('does not process jobs concurrently when drainQueue is called while already running', async () => {
    const job = makeJob('sum-5', 'cand-5');
    queueService.getQueuedJobs.mockReturnValue([job]);

    let resolveProvider!: () => void;
    candidatesService.getDocumentsForCandidate.mockResolvedValue([{ rawText: 'text' }]);
    summarizationProvider.generateCandidateSummary.mockReturnValue(
      new Promise<void>((res) => {
        resolveProvider = res;
      }).then(() => ({
        score: 60,
        strengths: [],
        concerns: [],
        summary: 'ok',
        recommendedDecision: 'hold',
      })),
    );

    // First call — starts processing but doesn't await yet
    const firstDrain = (worker as any).drainQueue() as Promise<void>;

    // Second call fires while first is still in-flight
    await (worker as any).drainQueue();

    // Only one processing call should have started so far
    expect(summarizationProvider.generateCandidateSummary).toHaveBeenCalledTimes(1);

    // Let the first drain finish
    resolveProvider();
    await firstDrain;
  });
});
