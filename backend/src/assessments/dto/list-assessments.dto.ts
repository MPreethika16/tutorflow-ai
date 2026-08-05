import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

import { AssessmentStatus } from '../../generated/prisma/client';

export class ListAssessmentsDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @IsOptional()
  @IsEnum(AssessmentStatus)
  status?: AssessmentStatus;

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
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}