import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Candidate } from './candidate.entity';

@Entity('candidate_documents')
export class CandidateDocument {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column({ name: 'candidate_id' })
  candidateId?: string;

  @Column({ name: 'document_type' })
  documentType?: 'resume' | 'cover_letter' | 'portfolio' | 'other';

  @Column({ name: 'file_name' })
  fileName?: string;

  @Column({ name: 'storage_key' })
  storageKey?: string;

  @Column({ name: 'raw_text', type: 'text' })
  rawText?: string;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt?: Date;

  @ManyToOne(() => Candidate, candidate => candidate.documents)
  @JoinColumn({ name: 'candidate_id' })
  candidate?: Candidate;
}