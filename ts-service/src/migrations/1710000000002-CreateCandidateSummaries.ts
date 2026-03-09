import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCandidateSummaries1710000000002 implements MigrationInterface {
  name = 'CreateCandidateSummaries1710000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE summary_status AS ENUM ('pending', 'completed', 'failed')
    `);
    
    await queryRunner.query(`
      CREATE TABLE candidate_summaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        status summary_status DEFAULT 'pending',
        score DECIMAL(3,1),
        strengths TEXT[],
        concerns TEXT[],
        summary TEXT,
        recommended_decision VARCHAR(20) CHECK (recommended_decision IN ('strong_yes', 'yes', 'maybe', 'no', 'strong_no')),
        provider VARCHAR(100),
        prompt_version VARCHAR(50),
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    await queryRunner.query(`
      CREATE INDEX idx_summaries_candidate ON candidate_summaries(candidate_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_summaries_status ON candidate_summaries(status)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE candidate_summaries`);
    await queryRunner.query(`DROP TYPE summary_status`);
  }
}