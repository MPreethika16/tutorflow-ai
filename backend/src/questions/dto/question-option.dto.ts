import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Length,
} from 'class-validator';

export class QuestionOptionDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 10)
  id!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  text!: string;
}