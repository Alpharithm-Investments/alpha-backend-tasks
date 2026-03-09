import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { CandidateDocument } from './candidate-document.entity';
import { CandidateSummary } from './candidate-summary.entity';
import { Workspace } from './workspace.entity';

@Entity('candidates')
export class Candidate {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column({ name: 'workspace_id' })
  workspaceId?: string;

  @Column()
  name?: string;

  @Column({ nullable: true })
  email?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @ManyToOne(() => Workspace, workspace => workspace.candidates)
  @JoinColumn({ name: 'workspace_id' })
  workspace?: Workspace;

  @OneToMany(() => CandidateDocument, document => document.candidate)
  documents?: CandidateDocument[];

  @OneToMany(() => CandidateSummary, summary => summary.candidate)
  summaries?: CandidateSummary[];
}