import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

import { SampleCandidate } from "./sample-candidate.entity";

export enum SummaryStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum RecommendedDecision {
  ADVANCE = "advance",
  HOLD = "hold",
  REJECT = "reject",
}

@Entity({ name: "candidate_summaries" })
export class CandidateSummary {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "candidate_id", type: "varchar", length: 64 })
  candidateId!: string;

  @Column({
    type: "varchar",
    length: 20,
    default: SummaryStatus.PENDING,
  })
  status!: SummaryStatus;

  @Column({ type: "integer", nullable: true })
  score!: number | null;

  @Column({ type: "text", nullable: true })
  strengths!: string | null;

  @Column({ type: "text", nullable: true })
  concerns!: string | null;

  @Column({ type: "text", nullable: true })
  summary!: string | null;

  @Column({
    name: "recommended_decision",
    type: "varchar",
    length: 20,
    nullable: true,
  })
  recommendedDecision!: RecommendedDecision | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  provider!: string | null;

  @Column({
    name: "prompt_version",
    type: "varchar",
    length: 20,
    nullable: true,
  })
  promptVersion!: string | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt!: Date | null;

  @ManyToOne(() => SampleCandidate, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "candidate_id" })
  candidate!: SampleCandidate;
}
