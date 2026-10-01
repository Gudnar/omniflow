import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateKnowledgeDocumentDto {
  @IsString()
  @MinLength(1)
  declare title: string;

  @IsString()
  @MinLength(1)
  declare content: string;

  @IsIn(['ACTIVE', 'INACTIVE'])
  @IsOptional()
  declare status?: 'ACTIVE' | 'INACTIVE';
}

export class UpdateKnowledgeDocumentDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare title?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  declare content?: string;

  @IsIn(['ACTIVE', 'INACTIVE'])
  @IsOptional()
  declare status?: 'ACTIVE' | 'INACTIVE';
}
