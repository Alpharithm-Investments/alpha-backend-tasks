import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { DataSourceOptions } from "typeorm";

import { SampleCandidate } from "../entities/sample-candidate.entity";
import { SampleWorkspace } from "../entities/sample-workspace.entity";
import { CandidateDocument } from "../entities/candidate-document.entity";
import { CandidateSummary } from "../entities/candidate-summary.entity";
import { InitialStarterEntities1710000000000 } from "../migrations/1710000000000-InitialStarterEntities";
import { AddCandidateDocumentsAndSummaries1710000001000 } from "../migrations/1710000001000-AddCandidateDocumentsAndSummaries";

export const defaultDatabaseUrl =
  "postgres://assessment_user:assessment_pass@localhost:5432/assessment_db";

export const getTypeOrmOptions = (
  databaseUrl: string,
): TypeOrmModuleOptions & DataSourceOptions => ({
  type: "postgres",
  url: databaseUrl,
  entities: [SampleWorkspace, SampleCandidate, CandidateDocument, CandidateSummary],
  migrations: [
    InitialStarterEntities1710000000000,
    AddCandidateDocumentsAndSummaries1710000001000,
  ],
  migrationsTableName: "typeorm_migrations",
  synchronize: false,
  logging: false,
});
