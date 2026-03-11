import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';

const user = { userId: 'user-1', workspaceId: 'ws-1' };

const fakeDoc = (): CandidateDocument =>
  ({
    id: 'doc-1',
    candidateId: 'cand-1',
    documentType: 'resume',
    fileName: 'cv.pdf',
    storageKey: 'uploads/cand-1/doc-1/cv.pdf',
    rawText: 'Some resume text',
    uploadedAt: new Date('2026-01-01T00:00:00Z'),
  }) as CandidateDocument;

const fakeSummary = (overrides: Partial<CandidateSummary> = {}): CandidateSummary =>
  ({
    id: 'sum-1',
    candidateId: 'cand-1',
    status: 'pending',
    score: null,
    strengths: null,
    concerns: null,
    summary: null,
    recommendedDecision: null,
    provider: null,
    promptVersion: null,
    errorMessage: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }) as CandidateSummary;

describe('CandidatesController', () => {
  let controller: CandidatesController;

  const service = {
    uploadDocument: jest.fn(),
    requestSummary: jest.fn(),
    listSummaries: jest.fn(),
    getSummary: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CandidatesController],
      providers: [{ provide: CandidatesService, useValue: service }],
    }).compile();

    controller = module.get<CandidatesController>(CandidatesController);
  });

  // ── POST /documents ─────────────────────────────────────────────────────────

  describe('uploadDocument', () => {
    it('returns a DocumentResponseDto on success', async () => {
      service.uploadDocument.mockResolvedValue(fakeDoc());

      const result = await controller.uploadDocument(user, 'cand-1', {
        documentType: 'resume',
        fileName: 'cv.pdf',
        rawText: 'Some resume text',
      });

      expect(result).toMatchObject({
        id: 'doc-1',
        candidateId: 'cand-1',
        documentType: 'resume',
        fileName: 'cv.pdf',
        storageKey: 'uploads/cand-1/doc-1/cv.pdf',
      });
      expect(service.uploadDocument).toHaveBeenCalledWith(user, 'cand-1', expect.any(Object));
    });

    it('propagates NotFoundException when candidate does not exist', async () => {
      service.uploadDocument.mockRejectedValue(new NotFoundException('Candidate not found'));

      await expect(
        controller.uploadDocument(user, 'missing', {
          documentType: 'resume',
          fileName: 'cv.pdf',
          rawText: 'text',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates ForbiddenException for cross-workspace access', async () => {
      service.uploadDocument.mockRejectedValue(
        new ForbiddenException('You do not have access to this candidate'),
      );

      await expect(
        controller.uploadDocument(user, 'cand-other-ws', {
          documentType: 'cover_letter',
          fileName: 'letter.pdf',
          rawText: 'text',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── POST /summaries/generate ────────────────────────────────────────────────

  describe('requestSummary', () => {
    it('returns a pending SummaryResponseDto', async () => {
      service.requestSummary.mockResolvedValue(fakeSummary());

      const result = await controller.requestSummary(user, 'cand-1');

      expect(result).toMatchObject({ id: 'sum-1', candidateId: 'cand-1', status: 'pending' });
      expect(service.requestSummary).toHaveBeenCalledWith(user, 'cand-1');
    });

    it('propagates NotFoundException when candidate does not exist', async () => {
      service.requestSummary.mockRejectedValue(new NotFoundException());

      await expect(controller.requestSummary(user, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── GET /summaries ──────────────────────────────────────────────────────────

  describe('listSummaries', () => {
    it('returns an array of SummaryResponseDtos', async () => {
      service.listSummaries.mockResolvedValue([
        fakeSummary({ id: 'sum-1', status: 'completed', score: 85 }),
        fakeSummary({ id: 'sum-2', status: 'pending' }),
      ]);

      const result = await controller.listSummaries(user, 'cand-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'sum-1', status: 'completed', score: 85 });
      expect(result[1]).toMatchObject({ id: 'sum-2', status: 'pending' });
    });

    it('returns an empty array when no summaries exist', async () => {
      service.listSummaries.mockResolvedValue([]);

      const result = await controller.listSummaries(user, 'cand-1');

      expect(result).toEqual([]);
    });
  });

  // ── GET /summaries/:summaryId ───────────────────────────────────────────────

  describe('getSummary', () => {
    it('returns a completed summary with all fields populated', async () => {
      service.getSummary.mockResolvedValue(
        fakeSummary({
          status: 'completed',
          score: 80,
          strengths: ['Strong communicator'],
          concerns: ['Limited leadership'],
          summary: 'Good candidate overall.',
          recommendedDecision: 'advance',
          provider: 'GeminiSummarizationProvider',
          promptVersion: 'v1',
        }),
      );

      const result = await controller.getSummary(user, 'cand-1', 'sum-1');

      expect(result).toMatchObject({
        status: 'completed',
        score: 80,
        strengths: ['Strong communicator'],
        recommendedDecision: 'advance',
      });
      expect(service.getSummary).toHaveBeenCalledWith(user, 'cand-1', 'sum-1');
    });

    it('returns a failed summary with errorMessage', async () => {
      service.getSummary.mockResolvedValue(
        fakeSummary({ status: 'failed', errorMessage: 'Gemini API error 429: quota exceeded' }),
      );

      const result = await controller.getSummary(user, 'cand-1', 'sum-1');

      expect(result).toMatchObject({
        status: 'failed',
        errorMessage: 'Gemini API error 429: quota exceeded',
      });
    });

    it('propagates NotFoundException when summary does not exist', async () => {
      service.getSummary.mockRejectedValue(new NotFoundException('Summary not found'));

      await expect(controller.getSummary(user, 'cand-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates ForbiddenException for cross-workspace access', async () => {
      service.getSummary.mockRejectedValue(new ForbiddenException());

      await expect(controller.getSummary(user, 'cand-other', 'sum-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
