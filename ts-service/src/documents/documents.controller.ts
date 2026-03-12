import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { FakeAuthGuard } from '../auth/fake-auth.guard';
import { CreateCandidateDocumentDto } from './dto/create-candidate-document.dto';
import { ListCandidateSummariesQueryDto } from './dto/list-summaries-query.dto';
import { DocumentsService } from './documents.service';

@Controller('candidates/:candidateId')
@UseGuards(FakeAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('documents')
  async uploadDocument(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @Body() dto: CreateCandidateDocumentDto,
  ) {
    return this.documentsService.createDocument(user, candidateId, dto);
  }

  @Get('documents')
  async listDocuments(@CurrentUser() user: AuthUser, @Param('candidateId') candidateId: string) {
    return this.documentsService.listDocuments(user, candidateId);
  }

  @Get('summaries')
  async listSummaries(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
    @Query() queryDto: ListCandidateSummariesQueryDto,
  ) {
    return this.documentsService.listSummaries(user, candidateId, queryDto.status);
  }

  @Get('summaries/:summaryId')
  async getSummary(
    @CurrentUser() user: AuthUser,
    @Param('summaryId') summaryId: string,
  ) {
    const summary = await this.documentsService.getSummary(user, summaryId);
    if (!summary) {
      throw new NotFoundException('Summary not found');
    }
    return summary;
  }

  @Post('summaries/generate')
  async generateSummary(
    @CurrentUser() user: AuthUser,
    @Param('candidateId') candidateId: string,
  ) {
    // create pending summary; queue processing comes later in step 6
    return this.documentsService.createPendingSummary(candidateId);
  }
}
