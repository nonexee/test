import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class RegisterTenantDto {
  @IsString()
  @MinLength(2)
  tenantName: string;

  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).{8,}$/, {
    message:
      'Password must be at least 8 characters and contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character',
  })
  adminPassword: string;
}
