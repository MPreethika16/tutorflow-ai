import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

import {
  AssessmentKind,
} from '../../generated/prisma/client';

export class GeneratePaperDto {
  @IsString()
  @Length(2, 50)
  board!: string;

  @IsString()
  @Length(1, 20)
  grade!: string;

  @IsString()
  @Length(2, 100)
  subject!: string;

  @IsString()
  @Length(2, 200)
  topic!: string;

  @IsEnum(AssessmentKind)
  kind!: AssessmentKind;

  @IsInt()
  @Min(1)
  @Max(100)
  totalMarks!: number;

  @IsInt()
  @Min(5)
  @Max(300)
  durationMinutes!: number;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  additionalInstructions?: string;
}