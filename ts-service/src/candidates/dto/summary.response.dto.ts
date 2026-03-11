import { CandidateSummary } from '../../entities/candidate-summary.entity';

export class SummaryResponseDto {
  id!: string;
  candidateId!: string;
  status!: string;
  score!: number | null;
  strengths!: string[] | null;
  concerns!: string[] | null;
  summary!: string | null;
  recommendedDecision!: string | null;
  provider!: string | null;
  promptVersion!: string | null;
  errorMessage!: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  static from(s: CandidateSummary): SummaryResponseDto {
    const dto = new SummaryResponseDto();
    dto.id = s.id;
    dto.candidateId = s.candidateId;
    dto.status = s.status;
    dto.score = s.score;
    dto.strengths = s.strengths;
    dto.concerns = s.concerns;
    dto.summary = s.summary;
    dto.recommendedDecision = s.recommendedDecision;
    dto.provider = s.provider;
    dto.promptVersion = s.promptVersion;
    dto.errorMessage = s.errorMessage;
    dto.createdAt = s.createdAt;
    dto.updatedAt = s.updatedAt;
    return dto;
  }
}
