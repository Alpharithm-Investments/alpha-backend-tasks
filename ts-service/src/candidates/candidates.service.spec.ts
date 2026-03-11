import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { QueueService } from '../queue/queue.service';
import { CandidatesService, SUMMARY_JOB_NAME } from './candidates.service';

const mockCandidate = (overrides: Partial<SampleCandidate> = {}): SampleCandidate => ({
  id: 'cand-1',
  workspaceId: 'ws-1',
  fullName: 'Ada Lovelace',
  email: null,
  createdAt: new Date(),
  workspace: undefined as any,
  ...overrides,
});

describe('CandidatesService', () => {
  let service: CandidatesService;

  const candidateRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const documentRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const summaryRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const queueService = {
    enqueue: jest.fn(),
    getQueuedJobs: jest.fn(() => []),
    markProcessed: jest.fn(),
    getAllJobs: jest.fn(() => []),
  };

  const user = { userId: 'user-1', workspaceId: 'ws-1' };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidatesService,
        { provide: getRepositoryToken(SampleCandidate), useValue: candidateRepo },
        { provide: getRepositoryToken(CandidateDocument), useValue: documentRepo },
        { provide: getRepositoryToken(CandidateSummary), useValue: summaryRepo },
        { provide: QueueService, useValue: queueService },
      ],
    }).compile();

    service = module.get<CandidatesService>(CandidatesService);
  });

  // ── uploadDocument ─────────────────────────────────────────────────────────

  describe('uploadDocument', () => {
    it('creates and returns a document for a valid candidate', async () => {
      candidateRepo.findOne.mockResolvedValue(mockCandidate());
      const fakeDoc = { id: 'doc-1', candidateId: 'cand-1' };
      documentRepo.create.mockReturnValue(fakeDoc);
      documentRepo.save.mockResolvedValue(fakeDoc);

      const result = await service.uploadDocument(user, 'cand-1', {
        documentType: 'resume',
        fileName: 'cv.pdf',
        rawText: 'Some resume text',
      });

      expect(documentRepo.create).toHaveBeenCalled();
      expect(documentRepo.save).toHaveBeenCalled();
      expect(result).toEqual(fakeDoc);
    });

    it('throws NotFoundException when candidate does not exist', async () => {
      candidateRepo.findOne.mockResolvedValue(null);
      await expect(
        service.uploadDocument(user, 'missing', {
          documentType: 'resume',
          fileName: 'cv.pdf',
          rawText: 'text',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when candidate belongs to a different workspace', async () => {
      candidateRepo.findOne.mockResolvedValue(mockCandidate({ workspaceId: 'other-ws' }));
      await expect(
        service.uploadDocument(user, 'cand-1', {
          documentType: 'resume',
          fileName: 'cv.pdf',
          rawText: 'text',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── requestSummary ─────────────────────────────────────────────────────────

  describe('requestSummary', () => {
    it('creates a pending summary and enqueues a job', async () => {
      candidateRepo.findOne.mockResolvedValue(mockCandidate());
      const pendingSummary = { id: 'sum-1', candidateId: 'cand-1', status: 'pending' };
      summaryRepo.create.mockReturnValue(pendingSummary);
      summaryRepo.save.mockResolvedValue(pendingSummary);

      const result = await service.requestSummary(user, 'cand-1');

      expect(result.status).toBe('pending');
      expect(queueService.enqueue).toHaveBeenCalledWith(
        SUMMARY_JOB_NAME,
        expect.objectContaining({ summaryId: 'sum-1', candidateId: 'cand-1' }),
      );
    });
  });

  // ── listSummaries ──────────────────────────────────────────────────────────

  describe('listSummaries', () => {
    it('returns summaries scoped to the correct candidate', async () => {
      candidateRepo.findOne.mockResolvedValue(mockCandidate());
      const fakeSummaries = [{ id: 'sum-1' }, { id: 'sum-2' }];
      summaryRepo.find.mockResolvedValue(fakeSummaries);

      const result = await service.listSummaries(user, 'cand-1');
      expect(result).toHaveLength(2);
    });

    it('throws ForbiddenException for cross-workspace access', async () => {
      candidateRepo.findOne.mockResolvedValue(mockCandidate({ workspaceId: 'other-ws' }));
      await expect(service.listSummaries(user, 'cand-1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── getSummary ─────────────────────────────────────────────────────────────

  describe('getSummary', () => {
    it('returns summary when it exists and belongs to candidate', async () => {
      candidateRepo.findOne.mockResolvedValue(mockCandidate());
      const fakeSummary = { id: 'sum-1', candidateId: 'cand-1', status: 'completed' };
      summaryRepo.findOne.mockResolvedValue(fakeSummary);

      const result = await service.getSummary(user, 'cand-1', 'sum-1');
      expect(result.id).toBe('sum-1');
    });

    it('throws NotFoundException when summary does not exist', async () => {
      candidateRepo.findOne.mockResolvedValue(mockCandidate());
      summaryRepo.findOne.mockResolvedValue(null);

      await expect(service.getSummary(user, 'cand-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
