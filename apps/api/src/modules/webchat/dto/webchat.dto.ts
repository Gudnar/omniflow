import { IsString, MinLength } from 'class-validator';

export class SendWebchatMessageDto {
  @IsString()
  @MinLength(1)
  declare webchatToken: string;

  @IsString()
  @MinLength(1)
  declare content: string;
}
