import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  board?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  rollNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  parentName?: string;
}