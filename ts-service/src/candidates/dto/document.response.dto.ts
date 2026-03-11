import { CandidateDocument } from '../../entities/candidate-document.entity';

export class DocumentResponseDto {
  id!: string;
  candidateId!: string;
  documentType!: string;
  fileName!: string;
  storageKey!: string;
  uploadedAt!: Date;

  static from(doc: CandidateDocument): DocumentResponseDto {
    const dto = new DocumentResponseDto();
    dto.id = doc.id;
    dto.candidateId = doc.candidateId;
    dto.documentType = doc.documentType;
    dto.fileName = doc.fileName;
    dto.storageKey = doc.storageKey;
    dto.uploadedAt = doc.uploadedAt;
    return dto;
  }
}
