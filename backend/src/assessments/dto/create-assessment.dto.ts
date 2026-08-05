import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateAssessmentDto {
  /**
   * Assessment title.
   *
   * Example:
   * Chapter 1 Test
   */
  @IsString()
  @Length(3, 100)
  title!: string;

  /**
   * Optional description.
   */
  @IsOptional()
  @IsString()
  @Length(3, 500)
  description?: string;

  /**
   * Board
   *
   * Example:
   * CBSE
   */
  @IsString()
  @Length(2, 50)
  board!: string;

  /**
   * Grade
   *
   * Example:
   * 10
   */
  @IsString()
  @Length(1, 20)
  grade!: string;

  /**
   * Subject
   *
   * Example:
   * Mathematics
   */
  @IsString()
  @Length(2, 100)
  subject!: string;

  /**
   * Draft assessments may not yet have
   * a duration.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  /**
   * Optional instructions.
   */
  @IsOptional()
  @IsString()
  @Length(3, 1000)
  instructions?: string;

  /**
   * Optional start time.
   *
   * Validation requiring both dates
   * will happen in the service.
   */
  @IsOptional()
  @IsDateString()
  startAt?: string;

  /**
   * Optional end time.
   */
  @IsOptional()
  @IsDateString()
  endAt?: string;
}