import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidatesService } from './candidates.service';
import { Candidate } from '../entities/candidate.entity';
import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { QueueService } from '../queue/queue.service';
import { SummarizationProvider } from '../llm/summarization-provider.interface';

describe('CandidatesService', () => {
  let service: CandidatesService;
  let candidateRepo: jest.Mocked<Repository<Candidate>>;
  let documentRepo: jest.Mocked<Repository<CandidateDocument>>;
  let summaryRepo: jest.Mocked<Repository<CandidateSummary>>;
  let queueService: jest.Mocked<QueueService>;
  let llmProvider: jest.Mocked<SummarizationProvider>;

  const mockCandidate = {
    id: 'cand-123',
    workspaceId: 'ws-123',
    name: 'John Doe',
    documents: []
  } as Candidate;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidatesService,
        {
          provide: getRepositoryToken(Candidate),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn()
          }
        },
        {
          provide: getRepositoryToken(CandidateDocument),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn()
          }
        },
        {
          provide: getRepositoryToken(CandidateSummary),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn()
          }
        },
        {
          provide: QueueService,
          useValue: {
            enqueue: jest.fn()
          }
        },
        {
          provide: 'SummarizationProvider',
          useValue: {
            generateCandidateSummary: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<CandidatesService>(CandidatesService);
    candidateRepo = module.get(getRepositoryToken(Candidate));
    documentRepo = module.get(getRepositoryToken(CandidateDocument));
    summaryRepo = module.get(getRepositoryToken(CandidateSummary));
    queueService = module.get(QueueService);
    llmProvider = module.get('SummarizationProvider');
  });

  describe('uploadDocument', () => {
    it('should upload document for valid candidate', async () => {
      candidateRepo.findOne.mockResolvedValue(mockCandidate);
      documentRepo.create.mockReturnValue({ id: 'doc-123' } as CandidateDocument);
      documentRepo.save.mockResolvedValue({ id: 'doc-123' } as CandidateDocument);

      const result = await service.uploadDocument('cand-123', 'ws-123', {
        documentType: 'resume',
        fileName: 'resume.pdf',
        storageKey: 'uploads/resume.pdf',
        rawText: 'Candidate experience...'
      });

      expect(result.id).toBe('doc-123');
      expect(documentRepo.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for wrong workspace', async () => {
      candidateRepo.findOne.mockResolvedValue(mockCandidate);

      await expect(
        service.uploadDocument('cand-123', 'ws-999', {
          documentType: 'resume',
          fileName: 'resume.pdf',
          storageKey: 'uploads/resume.pdf',
          rawText: 'text'
        })
      ).rejects.toThrow('Access denied');
    });
  });

  describe('requestSummaryGeneration', () => {
    it('should create pending summary and queue job', async () => {
      const candidateWithDocs = {
        ...mockCandidate,
        documents: [{ id: 'doc-1' } as CandidateDocument]
      };
      candidateRepo.findOne.mockResolvedValue(candidateWithDocs);
      summaryRepo.create.mockReturnValue({ id: 'sum-123', status: 'pending' } as CandidateSummary);
      summaryRepo.save.mockResolvedValue({ id: 'sum-123', status: 'pending' } as CandidateSummary);

      const result = await service.requestSummaryGeneration('cand-123', 'ws-123', {});

      expect(result.status).toBe('pending');
      expect(queueService.enqueue).toHaveBeenCalledWith('generate-summary', {
        summaryId: 'sum-123',
        candidateId: 'cand-123',
        promptVersion: undefined
      });
    });
  });
});