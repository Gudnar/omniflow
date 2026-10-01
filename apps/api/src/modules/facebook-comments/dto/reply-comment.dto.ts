import { IsString, MinLength } from 'class-validator';

export class ReplyCommentDto {
  @IsString()
  @MinLength(1)
  declare message: string;
}
