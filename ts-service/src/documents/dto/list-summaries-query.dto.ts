import { IsEnum, IsOptional } from 'class-validator';

import { SummaryStatus } from '../../entities/candidate-summary.entity';

export class ListCandidateSummariesQueryDto {
  @IsOptional()
  @IsEnum(SummaryStatus)
  status?: SummaryStatus;
}
