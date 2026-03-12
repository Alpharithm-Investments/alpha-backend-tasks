import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SampleModule } from '../src/sample/sample.module';
import { DocumentsModule } from '../src/documents/documents.module';
import { QueueModule } from '../src/queue/queue.module';
import { LlmModule } from '../src/llm/llm.module';
import { SampleWorkspace } from '../src/entities/sample-workspace.entity';
import { SampleCandidate } from '../src/entities/sample-candidate.entity';
import { CandidateDocument } from '../src/entities/candidate-document.entity';
import { CandidateSummary, SummaryStatus } from '../src/entities/candidate-summary.entity';
import { SampleService } from '../src/sample/sample.service';
import { DocumentsService } from '../src/documents/documents.service';
import { QueueService } from '../src/queue/queue.service';
import { QueueWorkerService } from '../src/queue/queue-worker.service';
import { AuthUser } from '../src/auth/auth.types';
import { GENERATE_SUMMARY_JOB, GenerateSummaryJobPayload } from '../src/queue/queue.types';

describe('Full workflow integration (e2e)', () => {
  let module: TestingModule;
  let sampleService: SampleService;
  let documentsService: DocumentsService;
  let queueService: QueueService;
  let queueWorker: QueueWorkerService;

  const user: AuthUser = { userId: 'user1', workspaceId: 'workspace1' };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            SampleWorkspace,
            SampleCandidate,
            CandidateDocument,
            CandidateSummary,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([
          SampleWorkspace,
          SampleCandidate,
          CandidateDocument,
          CandidateSummary,
        ]),
        LlmModule,
        QueueModule,
        SampleModule,
        DocumentsModule,
      ],
    }).compile();

    sampleService = module.get<SampleService>(SampleService);
    documentsService = module.get<DocumentsService>(DocumentsService);
    queueService = module.get<QueueService>(QueueService);
    queueWorker = module.get<QueueWorkerService>(QueueWorkerService);
  });

  afterAll(async () => {
    const app = module.createNestApplication();
    await app.close();
  });

  it('uploads a document, enqueues a job, and ends with a completed summary', async () => {
    // create candidate (workspace is created implicitly)
    const candidate = await sampleService.createCandidate(user, {
      fullName: 'Test Candidate',
      email: 'test@example.com',
    });

    expect(candidate.workspaceId).toBe(user.workspaceId);

    // upload a document
    const doc = await documentsService.createDocument(user, candidate.id, {
      documentType: 'resume',
      fileName: 'resume.pdf',
      storageKey: 's3://bucket/resume.pdf',
      rawText: 'Lorem ipsum dolor sit amet.',
    });

    expect(doc.candidateId).toBe(candidate.id);

    // create pending summary
    const pending = await documentsService.createPendingSummary(candidate.id);
    expect(pending.status).toBe(SummaryStatus.PENDING);

    // enqueue job via queue service (simulating controller)
    queueService.enqueue<GenerateSummaryJobPayload>(GENERATE_SUMMARY_JOB, {
      summaryId: pending.id,
      candidateId: candidate.id,
    });

    // trigger worker processing manually rather than waiting for interval
    await (queueWorker as any).processPendingJobs();

    // fetch updated summary and verify completion
    const updated = await documentsService.getSummary(user, pending.id);
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe(SummaryStatus.COMPLETED);
    expect(updated!.summary).toContain('Fake summary');
  });
});