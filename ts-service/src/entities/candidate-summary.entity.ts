import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Candidate } from './candidate.entity';

export type SummaryStatus = 'pending' | 'completed' | 'failed';

@Entity('candidate_summaries')
export class CandidateSummary {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column({ name: 'candidate_id' })
  candidateId?: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  })
  status?: SummaryStatus;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  score?: number | null;

  @Column({ type: 'simple-array', nullable: true })
  strengths?: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  concerns?: string[] | null;

  @Column({ type: 'text', nullable: true })
  summary?: string | null;

  @Column({ name: 'recommended_decision', nullable: true })
  recommendedDecision?: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no' | null;

  @Column({ nullable: true })
  provider?: string | null;

  @Column({ name: 'prompt_version', nullable: true })
  promptVersion?: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @ManyToOne(() => Candidate, candidate => candidate.summaries)
  @JoinColumn({ name: 'candidate_id' })
  candidate?: Candidate;
}