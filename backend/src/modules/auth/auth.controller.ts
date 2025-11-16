import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register-tenant')
  @ApiOperation({
    summary: 'Register new tenant',
    description: 'Creates a new tenant with admin user. Returns JWT token for immediate login.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tenant and admin user created successfully. Returns JWT token.',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'JWT authentication token' },
        tenant: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
          },
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['ADMIN', 'EDITOR', 'VIEWER'] },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data or email already exists' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (3 registrations/min)' })
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 registrations per minute
  async registerTenant(@Body() dto: RegisterTenantDto) {
    return this.authService.registerTenant(dto);
  }

  @Post('login')
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticates user with email and password. Returns JWT token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful. Returns JWT token.',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'JWT authentication token' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['ADMIN', 'EDITOR', 'VIEWER'] },
            tenantId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (5 login attempts/min)' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
