import { Body, Controller, Post, HttpCode, HttpStatus, Res, Req, UnauthorizedException } from '@nestjs/common';
import { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
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
    description: 'Creates a new tenant with admin user. Sets httpOnly cookies for authentication (HIGH #12, MEDIUM #25).',
  })
  @ApiResponse({
    status: 201,
    description: 'Tenant and admin user created successfully. Tokens set in httpOnly cookies.',
    schema: {
      type: 'object',
      properties: {
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
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async registerTenant(@Body() dto: RegisterTenantDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.registerTenant(dto);

    // Set httpOnly cookies (HIGH #12: XSS protection)
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    // Return user and tenant info (not tokens)
    return {
      user: result.user,
      tenant: result.tenant,
    };
  }

  @Post('login')
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticates user with email and password. Sets httpOnly cookies for authentication (HIGH #12, MEDIUM #25).',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful. Tokens set in httpOnly cookies.',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['ADMIN', 'EDITOR', 'VIEWER'] },
          },
        },
        tenant: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (5 login attempts/min)' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);

    // Set httpOnly cookies (HIGH #12: XSS protection)
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    // Return user and tenant info (not tokens)
    return {
      user: result.user,
      tenant: result.tenant,
    };
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Uses refresh token from httpOnly cookie to get a new access token (MEDIUM #25).',
  })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'New access token generated' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refreshToken'];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const result = await this.authService.refreshAccessToken(refreshToken);

    // Set new access token cookie
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    return {
      user: result.user,
      tenant: result.tenant,
    };
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Logout user',
    description: 'Revokes refresh token and clears authentication cookies.',
  })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refreshToken'];

    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return { message: 'Logout successful' };
  }

  /**
   * Helper method to set auth cookies (HIGH #12)
   */
  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProduction = process.env.NODE_ENV === 'production';

    // Access token: 15 minutes
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Refresh token: 7 days
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
}
