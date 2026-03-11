import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { FakeAuthGuard } from '../auth/fake-auth.guard';
import { CandidatesService } from './candidates.service';
import { DocumentResponseDto } from './dto/document.response.dto';
import { SummaryResponseDto } from './dto/summary.response.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Controller('candidates/:candidateId')
@UseGuards(FakeAuthGuard)
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  async uploadDocument(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @Body() dto: UploadDocumentDto,
  ): Promise<DocumentResponseDto> {
   
   
    const doc = await this.candidatesService.uploadDocument(user, candidateId, dto);
    return DocumentResponseDto.from(doc);
  }

  @Post('summaries/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestSummary(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
  ): Promise<SummaryResponseDto> {
    const summary = await this.candidatesService.requestSummary(user, candidateId);
    return SummaryResponseDto.from(summary);
  }

  @Get('summaries')
  async listSummaries(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
  ): Promise<SummaryResponseDto[]> {
    const summaries = await this.candidatesService.listSummaries(user, candidateId);
    return summaries.map(SummaryResponseDto.from);
  }

  @Get('summaries/:summaryId')
  async getSummary(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @Param('summaryId') summaryId: string,
  ): Promise<SummaryResponseDto> {
    const summary = await this.candidatesService.getSummary(user, candidateId, summaryId);
    return SummaryResponseDto.from(summary);
  }
}
