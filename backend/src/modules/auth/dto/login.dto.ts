import { IsEmail, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'admin@acme.com',
    format: 'email',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    let sanitized = value.trim().toLowerCase();
    // Remove HTML tags (email validation will catch invalid formats)
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    return sanitized;
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;
}
