import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

import { QuestionType } from '../../generated/prisma/client';
import { QuestionOptionDto } from './question-option.dto';

export class CreateQuestionDto {
  @IsEnum(QuestionType)
  type!: QuestionType;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 2000)
  prompt!: string;

  @IsInt()
  @Min(1)
  marks!: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @IsOptional()
  @IsString()
  @Length(1, 10)
  correctOption?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  explanation?: string;

  @IsOptional()
  @IsString()
  @Length(3, 5000)
  modelAnswer?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3000)
  gradingInstructions?: string;
}