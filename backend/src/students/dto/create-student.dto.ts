import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @Length(2, 100)
  firstName!: string;

  @IsString()
  @Length(1, 100)
  lastName!: string;

  @IsString()
  @Length(2, 100)
  board!: string;

  @IsString()
  @Length(1, 50)
  grade!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  rollNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  parentName?: string;
}