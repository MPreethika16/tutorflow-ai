// src/questions/dto/reorder-question-item.dto.ts

import {
  IsInt,
  IsString,
  Min,
} from 'class-validator';

export class ReorderQuestionItemDto {
  @IsString()
  questionId!: string;

  @IsInt()
  @Min(1)
  order!: number;
}