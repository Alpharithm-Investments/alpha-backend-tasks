import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCandidateDocuments1710000000001 implements MigrationInterface {
  name = 'CreateCandidateDocuments1710000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE candidate_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('resume', 'cover_letter', 'portfolio', 'other')),
        file_name VARCHAR(255) NOT NULL,
        storage_key VARCHAR(500) NOT NULL,
        raw_text TEXT NOT NULL,
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    await queryRunner.query(`
      CREATE INDEX idx_documents_candidate ON candidate_documents(candidate_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE candidate_documents`);
  }
}