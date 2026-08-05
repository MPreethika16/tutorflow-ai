import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListStudentsDto {
  /**
   * Optional search text.
   *
   * Examples:
   * ?search=rahul
   * ?search=cbse
   */
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Page number.
   *
   * Default: 1
   * Minimum: 1
   */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page: number = 1;

  /**
   * Number of students per page.
   *
   * Default: 10
   * Minimum: 1
   * Maximum: 100
   */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}