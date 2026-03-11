import { randomUUID } from 'crypto';
import * as path from 'path';

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthUser } from '../auth/auth.types';
import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { QueueService } from '../queue/queue.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

export const SUMMARY_JOB_NAME = 'generate-candidate-summary';

export interface SummaryJobPayload {
  summaryId: string;
  candidateId: string;
}

@Injectable()
export class CandidatesService {
  constructor(
    @InjectRepository(SampleCandidate)
    private readonly candidateRepo: Repository<SampleCandidate>,
    @InjectRepository(CandidateDocument)
    private readonly documentRepo: Repository<CandidateDocument>,
    @InjectRepository(CandidateSummary)
    private readonly summaryRepo: Repository<CandidateSummary>,
    private readonly queueService: QueueService,
  ) {}

  // ── Documents ────────────────────────────────────────────────────────────

  async uploadDocument(
    user: AuthUser,
    candidateId: string,
    dto: UploadDocumentDto,
  ): Promise<CandidateDocument> {
    await this.resolveCandidate(user, candidateId);

    const id = randomUUID();
    const storageKey = path.posix.join('uploads', candidateId, id, dto.fileName);

    const doc = this.documentRepo.create({
      id,
      candidateId,
      documentType: dto.documentType,
      fileName: dto.fileName,
      storageKey,
      rawText: dto.rawText,
    });

    return this.documentRepo.save(doc);
  }

  // ── Summaries ─────────────────────────────────────────────────────────────

  async requestSummary(
    user: AuthUser,
    candidateId: string,
  ): Promise<CandidateSummary> {
    await this.resolveCandidate(user, candidateId);

    const summary = this.summaryRepo.create({
      id: randomUUID(),
      candidateId,
      status: 'pending',
    });

    const saved = await this.summaryRepo.save(summary);

    const payload: SummaryJobPayload = {
      summaryId: saved.id,
      candidateId,
    };
    this.queueService.enqueue<SummaryJobPayload>(SUMMARY_JOB_NAME, payload);

    return saved;
  }

  async listSummaries(
    user: AuthUser,
    candidateId: string,
  ): Promise<CandidateSummary[]> {
    await this.resolveCandidate(user, candidateId);

    return this.summaryRepo.find({
      where: { candidateId },
      order: { createdAt: 'DESC' },
    });
  }

  async getSummary(
    user: AuthUser,
    candidateId: string,
    summaryId: string,
  ): Promise<CandidateSummary> {
    await this.resolveCandidate(user, candidateId);

    const summary = await this.summaryRepo.findOne({
      where: { id: summaryId, candidateId },
    });

    if (!summary) {
      throw new NotFoundException('Summary not found');
    }

    return summary;
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  async getDocumentsForCandidate(candidateId: string): Promise<CandidateDocument[]> {
    return this.documentRepo.find({ where: { candidateId } });
  }

  async updateSummary(
    summaryId: string,
    updates: Partial<CandidateSummary>,
  ): Promise<void> {
    // Repository.update() bypasses TypeORM lifecycle hooks (@UpdateDateColumn
    // only fires on save()), so we set updatedAt explicitly.
    await this.summaryRepo.update(summaryId, { ...updates, updatedAt: new Date() });
  }

  private async resolveCandidate(
    user: AuthUser,
    candidateId: string,
  ): Promise<SampleCandidate> {
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    if (candidate.workspaceId !== user.workspaceId) {
      throw new ForbiddenException(
        'You do not have access to this candidate',
      );
    }

    return candidate;
  }
}
