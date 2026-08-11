import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';

function trimString({
  value,
}: {
  value: unknown;
}) {
  return typeof value === 'string'
    ? value.trim()
    : value;
}

export class SaveStudentAnswerDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 10)
  selectedOption?: string | null;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 5000)
  textAnswer?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsUrl({
    require_protocol: true,
    protocols: ['https'],
    require_valid_protocol: true,
  })
  @Length(1, 5000)
  voiceUrl?: string;
}