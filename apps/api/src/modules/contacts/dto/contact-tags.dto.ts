import { IsString } from 'class-validator';

export class AttachTagDto {
  @IsString()
  declare tagId: string;
}
