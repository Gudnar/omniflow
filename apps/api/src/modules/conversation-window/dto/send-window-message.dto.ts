import { IsString, MinLength } from 'class-validator';

export class SendWindowMessageDto {
  @IsString()
  @MinLength(1)
  declare content: string;
}
