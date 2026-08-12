import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  IsEnum,
} from 'class-validator';

import {
  AssessmentKind,
} from '../../generated/prisma/client';

export class UpdateAssessmentDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(3, 500)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  board?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  grade?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  subject?: string;

    @IsOptional()
    @IsEnum(AssessmentKind)
    kind?: AssessmentKind;
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  instructions?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;


}