import { IsString, IsEnum, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { VendorType, VendorCriticality } from '@prisma/client';

export class CreateVendorDto {
  @ApiProperty({
    description: 'Vendor name',
    example: 'AWS Cloud Services',
    minLength: 2,
    maxLength: 255,
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    // Trim whitespace
    let sanitized = value.trim();
    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[<>]/g, '');
    return sanitized;
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Type of vendor relationship',
    enum: VendorType,
    example: 'CLOUD_PROVIDER',
  })
  @IsEnum(VendorType)
  type: VendorType;

  @ApiProperty({
    description: 'Business criticality level',
    enum: VendorCriticality,
    example: 'HIGH',
  })
  @IsEnum(VendorCriticality)
  criticality: VendorCriticality;
}
