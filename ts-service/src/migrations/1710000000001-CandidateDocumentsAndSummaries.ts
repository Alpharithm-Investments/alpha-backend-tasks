import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CandidateDocumentsAndSummaries1710000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'candidate_documents',
        columns: [
          { name: 'id', type: 'varchar', length: '64', isPrimary: true },
          { name: 'candidate_id', type: 'varchar', length: '64', isNullable: false },
          { name: 'document_type', type: 'varchar', length: '30', isNullable: false },
          { name: 'file_name', type: 'varchar', length: '255', isNullable: false },
          { name: 'storage_key', type: 'varchar', length: '500', isNullable: false },
          { name: 'raw_text', type: 'text', isNullable: false },
          { name: 'uploaded_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'candidate_documents',
      new TableForeignKey({
        name: 'fk_candidate_documents_candidate_id',
        columnNames: ['candidate_id'],
        referencedTableName: 'sample_candidates',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'candidate_documents',
      new TableIndex({
        name: 'idx_candidate_documents_candidate_id',
        columnNames: ['candidate_id'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'candidate_summaries',
        columns: [
          { name: 'id', type: 'varchar', length: '64', isPrimary: true },
          { name: 'candidate_id', type: 'varchar', length: '64', isNullable: false },
          { name: 'status', type: 'varchar', length: '20', default: "'pending'", isNullable: false },
          { name: 'score', type: 'int', isNullable: true },
          { name: 'strengths', type: 'text', isArray: true, isNullable: true },
          { name: 'concerns', type: 'text', isArray: true, isNullable: true },
          { name: 'summary', type: 'text', isNullable: true },
          { name: 'recommended_decision', type: 'varchar', length: '20', isNullable: true },
          { name: 'provider', type: 'varchar', length: '60', isNullable: true },
          { name: 'prompt_version', type: 'varchar', length: '30', isNullable: true },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'candidate_summaries',
      new TableForeignKey({
        name: 'fk_candidate_summaries_candidate_id',
        columnNames: ['candidate_id'],
        referencedTableName: 'sample_candidates',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'candidate_summaries',
      new TableIndex({
        name: 'idx_candidate_summaries_candidate_id',
        columnNames: ['candidate_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('candidate_summaries', 'idx_candidate_summaries_candidate_id');
    await queryRunner.dropForeignKey('candidate_summaries', 'fk_candidate_summaries_candidate_id');
    await queryRunner.dropTable('candidate_summaries');

    await queryRunner.dropIndex('candidate_documents', 'idx_candidate_documents_candidate_id');
    await queryRunner.dropForeignKey('candidate_documents', 'fk_candidate_documents_candidate_id');
    await queryRunner.dropTable('candidate_documents');
  }
}