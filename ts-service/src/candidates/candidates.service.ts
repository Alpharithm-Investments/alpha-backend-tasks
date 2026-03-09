import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate } from '../entities/candidate.entity';
import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary, SummaryStatus } from '../entities/candidate-summary.entity';
import { QueueService } from '../queue/queue.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { SummaryResponseDto } from './dto/summary-response.dto';
import { GenerateSummaryDto } from './dto/generate-summary.dto';

@Injectable()
export class CandidatesService {

  constructor(
    @InjectRepository(Candidate)
    private candidateRepo: Repository<Candidate>,
    @InjectRepository(CandidateDocument)
    private documentRepo: Repository<CandidateDocument>,
    @InjectRepository(CandidateSummary)
    private summaryRepo: Repository<CandidateSummary>,
    private queueService: QueueService
  ) {}

  async uploadDocument(
    candidateId: string, 
    workspaceId: string, 
    dto: UploadDocumentDto
  ): Promise<DocumentResponseDto> {
    // Verify candidate exists and belongs to workspace
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId }
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    if (candidate.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this candidate');
    }

    const document = this.documentRepo.create({
      candidateId,
      documentType: dto.documentType,
      fileName: dto.fileName,
      storageKey: dto.storageKey,
      rawText: dto.rawText
    });

    await this.documentRepo.save(document);

    return this.mapToDocumentResponse(document);
  }

  async requestSummaryGeneration(
    candidateId: string,
    workspaceId: string,
    dto: GenerateSummaryDto
  ): Promise<SummaryResponseDto> {
    // Verify candidate access
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId },
      relations: ['documents']
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    if (candidate.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this candidate');
    }

    if (candidate.documents?.length === 0) {
      throw new NotFoundException('No documents available for summarization');
    }

    // Create pending summary
    const summary = this.summaryRepo.create({
      candidateId,
      status: 'pending',
      provider: null,
      promptVersion: dto.promptVersion || 'default'
    });

    await this.summaryRepo.save(summary);

    // Queue job
    await this.queueService.enqueue('generate-summary', {
      summaryId: summary.id,
      candidateId,
      promptVersion: dto.promptVersion
    });

    return this.mapToSummaryResponse(summary);
  }

  async getSummaries(
    candidateId: string, 
    workspaceId: string
  ): Promise<SummaryResponseDto[]> {
    // Verify access
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId }
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    if (candidate.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied');
    }

    const summaries = await this.summaryRepo.find({
      where: { candidateId },
      order: { createdAt: 'DESC' }
    });

    return summaries.map(s => this.mapToSummaryResponse(s));
  }

  async getSummary(
    candidateId: string,
    summaryId: string,
    workspaceId: string
  ): Promise<SummaryResponseDto> {
    // Verify access
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId }
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    if (candidate.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied');
    }

    const summary = await this.summaryRepo.findOne({
      where: { id: summaryId, candidateId }
    });

    if (!summary) {
      throw new NotFoundException('Summary not found');
    }

    return this.mapToSummaryResponse(summary);
  }

  private mapToDocumentResponse(doc: CandidateDocument): DocumentResponseDto {
    return {
      id: doc.id as string,
      candidateId: doc.candidateId as string,
      documentType: doc.documentType as string,
      fileName: doc.fileName as string,
      storageKey: doc.storageKey as string,
      uploadedAt: doc.uploadedAt as Date,
    };
  }


  private mapToSummaryResponse(summary: CandidateSummary): SummaryResponseDto {
    return {
      id: summary.id as string,
      candidateId: summary.candidateId as string,
      status: summary.status as SummaryStatus,
      score: summary.score as number,
      strengths: summary.strengths as [],
      concerns: summary.concerns as [], 
      summary: summary.summary as string,
      recommendedDecision: summary.recommendedDecision as any,
      provider: summary.provider as string,
      promptVersion: summary.promptVersion as string,
      errorMessage: summary.errorMessage as string,
      createdAt: summary.createdAt as Date,
      updatedAt: summary.updatedAt as Date
    };
  }
}