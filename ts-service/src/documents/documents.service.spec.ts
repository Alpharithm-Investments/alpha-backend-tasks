import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary, SummaryStatus } from '../entities/candidate-summary.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { SampleWorkspace } from '../entities/sample-workspace.entity';
import { AuthUser } from '../auth/auth.types';
import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let workspaceRepo: Repository<SampleWorkspace>;
  let candidateRepo: Repository<SampleCandidate>;
  let documentRepo: Repository<CandidateDocument>;
  let summaryRepo: Repository<CandidateSummary>;

  const mockUser: AuthUser = {
    userId: 'user-1',
    workspaceId: 'workspace-1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getRepositoryToken(SampleWorkspace),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SampleCandidate),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CandidateDocument),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CandidateSummary),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    workspaceRepo = module.get<Repository<SampleWorkspace>>(
      getRepositoryToken(SampleWorkspace),
    );
    candidateRepo = module.get<Repository<SampleCandidate>>(
      getRepositoryToken(SampleCandidate),
    );
    documentRepo = module.get<Repository<CandidateDocument>>(
      getRepositoryToken(CandidateDocument),
    );
    summaryRepo = module.get<Repository<CandidateSummary>>(
      getRepositoryToken(CandidateSummary),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDocument', () => {
    it('should create document for valid candidate', async () => {
      const candidate = { id: 'cand-1', workspaceId: 'workspace-1' };
      const dto = {
        documentType: 'resume',
        fileName: 'resume.pdf',
        storageKey: 's3://bucket/resume.pdf',
        rawText: 'resume content',
      };

      jest.spyOn(candidateRepo, 'findOne').mockResolvedValue(candidate as any);
      jest.spyOn(documentRepo, 'create').mockReturnValue({
        id: 'doc-1',
        candidateId: 'cand-1',
        ...dto,
        uploadedAt: new Date(),
        createdAt: new Date(),
      } as any);
      jest.spyOn(documentRepo, 'save').mockResolvedValue({ id: 'doc-1' } as any);

      const result = await service.createDocument(mockUser, 'cand-1', dto);

      expect(result.id).toBe('doc-1');
      expect(candidateRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'cand-1', workspaceId: 'workspace-1' },
      });
    });

    it('should throw error if candidate not found', async () => {
      jest.spyOn(candidateRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.createDocument(mockUser, 'cand-notfound', {
          documentType: 'resume',
          fileName: 'resume.pdf',
          storageKey: 's3://bucket/resume.pdf',
          rawText: 'content',
        }),
      ).rejects.toThrow('Candidate not found or access denied');
    });
  });

  describe('listSummaries', () => {
    it('should list summaries for candidate', async () => {
      const candidate = { id: 'cand-1', workspaceId: 'workspace-1' };
      const summaries = [
        { id: 'sum-1', status: SummaryStatus.COMPLETED, candidateId: 'cand-1' },
      ];

      jest.spyOn(candidateRepo, 'findOne').mockResolvedValue(candidate as any);
      jest.spyOn(summaryRepo, 'find').mockResolvedValue(summaries as any);

      const result = await service.listSummaries(mockUser, 'cand-1');

      expect(result).toEqual(summaries);
      expect(summaryRepo.find).toHaveBeenCalledWith({
        where: { candidateId: 'cand-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('createPendingSummary', () => {
    it('should create pending summary', async () => {
      jest.spyOn(summaryRepo, 'create').mockReturnValue({
        id: 'sum-1',
        candidateId: 'cand-1',
        status: SummaryStatus.PENDING,
        createdAt: new Date(),
      } as any);
      jest.spyOn(summaryRepo, 'save').mockResolvedValue({ id: 'sum-1' } as any);

      const result = await service.createPendingSummary('cand-1');

      expect(result.id).toBe('sum-1');
      expect(result.status).toBe(SummaryStatus.PENDING);
    });
  });
});
