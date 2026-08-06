import { Type } from 'class-transformer';
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
  /**
   * Supported types:
   * MCQ, TYPED, VOICE
   */
  @IsEnum(QuestionType)
  type!: QuestionType;

  /**
   * The question shown to the student.
   */
  @IsString()
  @Length(3, 2000)
  prompt!: string;

  /**
   * Marks awarded for this question.
   */
  @IsInt()
  @Min(1)
  marks!: number;

  /**
   * Used only for MCQ questions.
   *
   * Type-specific required validation is handled
   * in the service because this field is not needed
   * for TYPED or VOICE questions.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  /**
   * ID of the correct MCQ option.
   *
   * Example: A
   */
  @IsOptional()
  @IsString()
  @Length(1, 10)
  correctOption?: string;

  /**
   * Optional explanation for an MCQ answer.
   */
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  explanation?: string;

  /**
   * Required for TYPED and VOICE questions.
   *
   * The teacher reviews this answer before publishing.
   */
  @IsOptional()
  @IsString()
  @Length(3, 5000)
  modelAnswer?: string;

  /**
   * Optional additional guidance for AI-assisted grading.
   */
  @IsOptional()
  @IsString()
  @Length(3, 3000)
  gradingInstructions?: string;
}