import { IsString, MinLength } from 'class-validator';

export class UpdateNoteDto {
  @IsString()
  @MinLength(1)
  declare body: string;
}
