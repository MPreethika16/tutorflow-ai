import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { QuestionOptionDto } from './question-option.dto';

export class UpdateQuestionDto {
  @ValidateIf((_dto, value) => value !== undefined)
  @IsString()
  @Length(3, 2000)
  prompt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  marks?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @ValidateIf((_dto, value) => value !== undefined)
  @IsString()
  @Length(1, 10)
  correctOption?: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsString()
  @Length(1, 2000)
  explanation?: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsString()
  @Length(3, 5000)
  modelAnswer?: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsString()
  @Length(3, 3000)
  gradingInstructions?: string;
}