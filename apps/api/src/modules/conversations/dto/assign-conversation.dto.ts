import { IsString, IsOptional } from 'class-validator';

export class AssignConversationDto {
  @IsString()
  @IsOptional()
  declare assignedToId?: string;
}
