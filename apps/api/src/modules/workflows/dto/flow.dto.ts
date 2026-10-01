import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FlowStatus, FlowNodeType } from '@omniflow/database';

export class CreateFlowDto {
  @IsString() @MinLength(1) declare name: string;
  @IsOptional() @IsString() declare description?: string;
}

export class FlowNodeInput {
  // Client-assigned temporary id (e.g. "n1") — remapped to a real id on
  // save so edges below can reference newly-created nodes.
  @IsString() declare clientId: string;
  @IsEnum(FlowNodeType) declare type: FlowNodeType;
  @IsString() declare subtype: string;
  @IsOptional() @IsString() declare name?: string;
  @IsObject() declare config: Record<string, any>;
  @IsNumber() declare positionX: number;
  @IsNumber() declare positionY: number;
}

export class FlowEdgeInput {
  @IsString() declare sourceClientId: string;
  @IsString() declare targetClientId: string;
  @IsOptional() @IsIn(['true', 'false']) declare sourceHandle?: 'true' | 'false';
}

export class UpdateFlowDto {
  @IsOptional() @IsString() @MinLength(1) declare name?: string;
  @IsOptional() @IsString() declare description?: string;
  @IsOptional() @IsEnum(FlowStatus) declare status?: FlowStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlowNodeInput)
  declare nodes?: FlowNodeInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlowEdgeInput)
  declare edges?: FlowEdgeInput[];
}

export class TestRunDto {
  @IsOptional() @IsObject() declare contextData?: Record<string, any>;
}

export class ListFlowsQueryDto {
  @IsOptional() @IsEnum(FlowStatus) declare status?: FlowStatus;
}

export class ListExecutionsQueryDto {
  @IsOptional() @IsString() declare status?: string;
}
