import { IsEnum, IsString, IsNotEmpty } from 'class-validator';

export class UploadDocumentDto {
  @IsEnum(['resume', 'cover_letter', 'portfolio', 'other'])
  documentType?: 'resume' | 'cover_letter' | 'portfolio' | 'other';

  @IsString()
  @IsNotEmpty()
  fileName?: string;

  @IsString()
  @IsNotEmpty()
  storageKey?: string;

  @IsString()
  @IsNotEmpty()
  rawText?: string;
}