import { Transform } from 'class-transformer';
import {
  IsString,
  IsUrl,
  Length,
  ValidateIf,
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
  @ValidateIf(
    (_dto, value) =>
      value !== undefined,
  )
  @Transform(trimString)
  @IsString()
  @Length(1, 10)
  selectedOption?: string;

  @ValidateIf(
    (_dto, value) =>
      value !== undefined,
  )
  @Transform(trimString)
  @IsString()
  @Length(1, 5000)
  textAnswer?: string;

  @ValidateIf(
    (_dto, value) =>
      value !== undefined,
  )
  @Transform(trimString)
  @IsString()
  @IsUrl({
    require_protocol: true,
  })
  @Length(1, 5000)
  voiceUrl?: string;
}