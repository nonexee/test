import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class RegisterTenantDto {
  @IsString()
  @MinLength(2)
  tenantName: string;

  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character',
  })
  adminPassword: string;
}
