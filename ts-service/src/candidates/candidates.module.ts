import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { Candidate } from '../entities/candidate.entity';
import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { QueueModule } from '../queue/queue.module';
import { LlmModule } from '../llm/llm.module';
import { GenerateSummaryProcessor } from './processors/generate-summary.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Candidate, CandidateDocument, CandidateSummary]),
    QueueModule,
    LlmModule
  ],
  controllers: [CandidatesController],
  providers: [CandidatesService, GenerateSummaryProcessor],
  exports: [CandidatesService]
})
export class CandidatesModule {}