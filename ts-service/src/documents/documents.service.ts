import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary, SummaryStatus } from '../entities/candidate-summary.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { SampleWorkspace } from '../entities/sample-workspace.entity';
import { AuthUser } from '../auth/auth.types';
import { CreateCandidateDocumentDto } from './dto/create-candidate-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(SampleWorkspace)
    private readonly workspaceRepository: Repository<SampleWorkspace>,
    @InjectRepository(SampleCandidate)
    private readonly candidateRepository: Repository<SampleCandidate>,
    @InjectRepository(CandidateDocument)
    private readonly documentRepository: Repository<CandidateDocument>,
    @InjectRepository(CandidateSummary)
    private readonly summaryRepository: Repository<CandidateSummary>,
  ) {}

  /**
   * Create a candidate document. Verifies workspace access.
   */
  async createDocument(
    user: AuthUser,
    candidateId: string,
    dto: CreateCandidateDocumentDto,
  ): Promise<CandidateDocument> {
    // verify candidate exists and belongs to user's workspace
    const candidate = await this.candidateRepository.findOne({
      where: { id: candidateId, workspaceId: user.workspaceId },
    });

    if (!candidate) {
      throw new Error('Candidate not found or access denied');
    }

    const document = this.documentRepository.create({
      id: randomUUID(),
      candidateId,
      documentType: dto.documentType.trim(),
      fileName: dto.fileName.trim(),
      storageKey: dto.storageKey.trim(),
      rawText: dto.rawText.trim(),
      uploadedAt: new Date(),
    });

    return this.documentRepository.save(document);
  }

  /**
   * List all documents for a candidate.
   */
  async listDocuments(
    user: AuthUser,
    candidateId: string,
  ): Promise<CandidateDocument[]> {
    // verify workspace access
    const candidate = await this.candidateRepository.findOne({
      where: { id: candidateId, workspaceId: user.workspaceId },
    });

    if (!candidate) {
      throw new Error('Candidate not found or access denied');
    }

    return this.documentRepository.find({
      where: { candidateId },
      order: { uploadedAt: 'DESC' },
    });
  }

  /**
   * Get a single document.
   */
  async getDocument(
    user: AuthUser,
    documentId: string,
  ): Promise<CandidateDocument | null> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['candidate'],
    });

    if (!document) {
      return null;
    }

    // verify workspace access
    if (document.candidate.workspaceId !== user.workspaceId) {
      throw new Error('Access denied');
    }

    return document;
  }

  /**
   * List summaries for a candidate (optionally filtered by status).
   */
  async listSummaries(
    user: AuthUser,
    candidateId: string,
    status?: SummaryStatus,
  ): Promise<CandidateSummary[]> {
    // verify workspace access
    const candidate = await this.candidateRepository.findOne({
      where: { id: candidateId, workspaceId: user.workspaceId },
    });

    if (!candidate) {
      throw new Error('Candidate not found or access denied');
    }

    const where: any = { candidateId };
    if (status) {
      where.status = status;
    }

    return this.summaryRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a single summary.
   */
  async getSummary(user: AuthUser, summaryId: string): Promise<CandidateSummary | null> {
    const summary = await this.summaryRepository.findOne({
      where: { id: summaryId },
      relations: ['candidate'],
    });

    if (!summary) {
      return null;
    }

    // verify workspace access
    if (summary.candidate.workspaceId !== user.workspaceId) {
      throw new Error('Access denied');
    }

    return summary;
  }

  /**
   * Create a pending summary for a candidate (used by the queue worker later).
   */
  async createPendingSummary(candidateId: string): Promise<CandidateSummary> {
    const summary = this.summaryRepository.create({
      id: randomUUID(),
      candidateId,
      status: SummaryStatus.PENDING,
      score: null,
      strengths: null,
      concerns: null,
      summary: null,
      recommendedDecision: null,
      provider: null,
      promptVersion: null,
      errorMessage: null,
      completedAt: null,
    });

    return this.summaryRepository.save(summary);
  }

  /**
   * Update a summary with completion data.
   */
  async updateSummary(
    summaryId: string,
    updates: Partial<CandidateSummary>,
  ): Promise<CandidateSummary> {
    await this.summaryRepository.update(summaryId, updates);
    const updated = await this.summaryRepository.findOne({
      where: { id: summaryId },
    });

    if (!updated) {
      throw new Error('Summary not found after update');
    }

    return updated;
  }
}
