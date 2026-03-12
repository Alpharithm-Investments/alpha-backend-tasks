import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';

import { SampleCandidate } from './sample-candidate.entity';

@Entity({ name: 'sample_workspaces' })
export class SampleWorkspace {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @OneToMany(() => SampleCandidate, (candidate) => candidate.workspace)
  candidates!: SampleCandidate[];
}
