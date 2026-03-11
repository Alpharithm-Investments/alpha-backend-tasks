import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { LlmModule } from '../llm/llm.module';
import { QueueModule } from '../queue/queue.module';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { SummaryWorker } from './summary.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([SampleCandidate, CandidateDocument, CandidateSummary]),
    QueueModule,
    LlmModule,
  ],
  controllers: [CandidatesController],
  providers: [CandidatesService, SummaryWorker],
})
export class CandidatesModule {}
