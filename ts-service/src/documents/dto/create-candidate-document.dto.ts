import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class CreateCandidateDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  documentType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  storageKey!: string;

  @IsString()
  @MinLength(1)
  rawText!: string;
}
