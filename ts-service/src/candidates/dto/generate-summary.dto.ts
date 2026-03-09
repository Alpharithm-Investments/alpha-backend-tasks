import { IsOptional, IsString } from 'class-validator';

export class GenerateSummaryDto {
  @IsOptional()
  @IsString()
  promptVersion?: string;
}