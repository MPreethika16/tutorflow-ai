// src/questions/dto/reorder-questions.dto.ts

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';

import { ReorderQuestionItemDto } from './reorder-question-item.dto';

export class ReorderQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderQuestionItemDto)
  questions!: ReorderQuestionItemDto[];
}