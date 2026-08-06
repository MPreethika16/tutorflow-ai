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
  ValidateNested,
} from 'class-validator';

import { QuestionOptionDto } from './question-option.dto';

export class UpdateQuestionDto {
  /**
   * New question prompt.
   *
   * Optional because PATCH supports partial updates.
   */
  @IsOptional()
  @IsString()
  @Length(3, 2000)
  prompt?: string;

  /**
   * New marks for the question.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  marks?: number;

  /**
   * MCQ options.
   *
   * When provided, exactly four options are required.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  /**
   * Correct MCQ option ID.
   *
   * Example: A
   */
  @IsOptional()
  @IsString()
  @Length(1, 10)
  correctOption?: string;

  /**
   * Optional MCQ explanation.
   */
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  explanation?: string;

  /**
   * Model answer for TYPED and VOICE questions.
   */
  @IsOptional()
  @IsString()
  @Length(3, 5000)
  modelAnswer?: string;

  /**
   * Optional instructions used later for AI-assisted grading.
   */
  @IsOptional()
  @IsString()
  @Length(3, 3000)
  gradingInstructions?: string;
}