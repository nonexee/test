import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      // Extract JWT from httpOnly cookie (HIGH #12 fix)
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Primary: Extract from httpOnly cookie
        (request: Request) => {
          return request?.cookies?.accessToken;
        },
        // Fallback: Authorization header for backward compatibility/testing
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    // Validate required JWT payload fields (LOW #34 fix)
    if (!payload.sub || !payload.tenantId || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify user belongs to the tenant specified in JWT
    if (user.tenantId !== payload.tenantId) {
      throw new UnauthorizedException('Token tenant mismatch');
    }

    // This will be attached to request.user
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      email: user.email,
    };
  }
}
