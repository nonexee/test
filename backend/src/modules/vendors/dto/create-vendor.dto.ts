import { IsString, IsEnum, MinLength } from 'class-validator';
import { VendorType, VendorCriticality } from '@prisma/client';

export class CreateVendorDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(VendorType)
  type: VendorType;

  @IsEnum(VendorCriticality)
  criticality: VendorCriticality;
}
