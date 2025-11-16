import { IsEmail, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterTenantDto {
  @ApiProperty({
    description: 'Tenant organization name',
    example: 'Acme Corporation',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  tenantName: string;

  @ApiProperty({
    description: 'Admin user email address',
    example: 'admin@acme.com',
    format: 'email',
  })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({
    description: 'Admin user password. Must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number/special character',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).{8,}$/, {
    message:
      'Password must be at least 8 characters and contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character',
  })
  adminPassword: string;
}
