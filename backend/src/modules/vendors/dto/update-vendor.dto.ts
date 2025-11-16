import { IsString, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VendorType, VendorCriticality, VendorStatus } from '@prisma/client';

export class UpdateVendorDto {
  @ApiPropertyOptional({
    description: 'Vendor name',
    example: 'AWS Cloud Services',
    minLength: 2,
    maxLength: 255,
  })
  @Transform(({ value }) => value?.trim())
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Type of vendor relationship',
    enum: VendorType,
    example: 'CLOUD_PROVIDER',
  })
  @IsOptional()
  @IsEnum(VendorType)
  type?: VendorType;

  @ApiPropertyOptional({
    description: 'Business criticality level',
    enum: VendorCriticality,
    example: 'HIGH',
  })
  @IsOptional()
  @IsEnum(VendorCriticality)
  criticality?: VendorCriticality;

  @ApiPropertyOptional({
    description: 'Vendor status',
    enum: VendorStatus,
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;
}
