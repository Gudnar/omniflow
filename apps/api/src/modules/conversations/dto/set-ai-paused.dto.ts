import { IsBoolean } from 'class-validator';

export class SetAiPausedDto {
  @IsBoolean()
  declare aiPaused: boolean;
}
