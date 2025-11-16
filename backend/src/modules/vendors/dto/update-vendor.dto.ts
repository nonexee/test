import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { VendorType, VendorCriticality, VendorStatus } from '@prisma/client';

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(VendorType)
  type?: VendorType;

  @IsOptional()
  @IsEnum(VendorCriticality)
  criticality?: VendorCriticality;

  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;
}
