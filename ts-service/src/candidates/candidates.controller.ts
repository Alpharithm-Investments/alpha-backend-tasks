import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { FakeAuthGuard as AuthGuard } from '../auth/fake-auth.guard';
import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { GenerateSummaryDto } from './dto/generate-summary.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { SummaryResponseDto } from './dto/summary-response.dto';

@Controller('candidates')
@UseGuards(AuthGuard)
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Post(':candidateId/documents')
  async uploadDocument(
    @Param('candidateId') candidateId: string,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: AuthUser
  ): Promise<DocumentResponseDto> {
    return this.candidatesService.uploadDocument(
      candidateId,
      user.workspaceId,
      dto
    );
  }

  @Post(':candidateId/summaries/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateSummary(
    @Param('candidateId') candidateId: string,
    @Body() dto: GenerateSummaryDto,
    @CurrentUser() user: AuthUser
  ): Promise<SummaryResponseDto> {
    return this.candidatesService.requestSummaryGeneration(
      candidateId,
      user.workspaceId,
      dto
    );
  }

  @Get(':candidateId/summaries')
  async getSummaries(
    @Param('candidateId') candidateId: string,
    @CurrentUser() user: AuthUser
  ): Promise<SummaryResponseDto[]> {
    return this.candidatesService.getSummaries(candidateId, user.workspaceId);
  }

  @Get(':candidateId/summaries/:summaryId')
  async getSummary(
    @Param('candidateId') candidateId: string,
    @Param('summaryId') summaryId: string,
    @CurrentUser() user: AuthUser
  ): Promise<SummaryResponseDto> {
    return this.candidatesService.getSummary(
      candidateId,
      summaryId,
      user.workspaceId
    );
  }
}