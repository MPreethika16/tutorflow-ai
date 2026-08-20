import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ReviewAnswerDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  teacherMarks?: number;

  @IsOptional()
  @IsString()
  teacherFeedback?: string;
}
