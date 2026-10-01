import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SectionItemDto } from './section-item.dto';

export class UpdateSectionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionItemDto)
  declare sections: SectionItemDto[];
}
