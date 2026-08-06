import {
  IsNotEmpty,
  IsString,
  Length,
} from 'class-validator';

export class QuestionOptionDto {
  /**
   * Public option label.
   *
   * Examples:
   * A, B, C, D
   */
  @IsString()
  @IsNotEmpty()
  @Length(1, 10)
  id!: string;

  /**
   * Text shown to the student.
   */
  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  text!: string;
}