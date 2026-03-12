import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";

import { SampleCandidate } from "./sample-candidate.entity";

@Entity({ name: "candidate_documents" })
export class CandidateDocument {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "candidate_id", type: "varchar", length: 64 })
  candidateId!: string;

  @Column({ name: "document_type", type: "varchar", length: 50 })
  documentType!: string;

  @Column({ name: "file_name", type: "varchar", length: 255 })
  fileName!: string;

  @Column({ name: "storage_key", type: "varchar", length: 255 })
  storageKey!: string;

  @Column({ name: "raw_text", type: "text" })
  rawText!: string;

  @Column({ name: "uploaded_at", type: "timestamptz" })
  uploadedAt!: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne(() => SampleCandidate, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "candidate_id" })
  candidate!: SampleCandidate;
}
