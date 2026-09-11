import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  identifier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}