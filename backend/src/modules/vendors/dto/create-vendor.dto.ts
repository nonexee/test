import { IsString, IsEnum, MinLength, MaxLength } from 'class-validator';
import { VendorType, VendorCriticality } from '@prisma/client';

export class CreateVendorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsEnum(VendorType)
  type: VendorType;

  @IsEnum(VendorCriticality)
  criticality: VendorCriticality;
}
