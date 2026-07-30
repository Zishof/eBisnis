import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 200;

export class BaseQueryDto {
  @ApiPropertyOptional({ description: 'Halaman, mulai dari 1.', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: `Jumlah baris per halaman (maks ${MAX_PAGE_SIZE}).`, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize = 25;

  @ApiPropertyOptional({ description: 'Kata kunci pencarian pada field yang di-whitelist.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Field pengurutan (harus ada pada whitelist resource).' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({
    description: 'Sertakan record yang sudah di-soft-delete. Memerlukan permission READ.',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeDeleted = false;

  @ApiPropertyOptional({ description: 'Sertakan record nonaktif.', default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeInactive = false;

  @ApiPropertyOptional({ description: 'Filter hanya data contoh.', default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  onlySample = false;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }
}

export interface PagedResult<T> {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function paged<T>(items: T[], total: number, query: BaseQueryDto): PagedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  return {
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
      hasNext: query.page < totalPages,
      hasPrev: query.page > 1,
    },
  };
}
