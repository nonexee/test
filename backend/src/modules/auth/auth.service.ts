import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, Tenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { AuditService } from '../../common/services/audit.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private geminiService: GeminiService,
    private auditService: AuditService,
  ) {}

  async registerTenant(dto: RegisterTenantDto) {
    // Hash password
    const passwordHash = await bcrypt.hash(dto.adminPassword, 12); // Increased from 10 to 12

    // Create a temporary tenant ID to create the store
    const tempTenantId = dto.tenantName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Create Gemini File Search store for this tenant
    const geminiFileSearchStoreName = await this.geminiService.createFileSearchStore(tempTenantId);

    try {
      // Create tenant and admin user in a transaction
      // Email uniqueness is enforced by database constraint
      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.tenantName,
            geminiFileSearchStoreName,
          },
        });

        const user = await tx.user.create({
          data: {
            email: dto.adminEmail,
            passwordHash,
            role: 'ADMIN',
            tenantId: tenant.id,
          },
        });

        return { tenant, user };
      });

      // Generate access and refresh tokens (HIGH #12, MEDIUM #25)
      const { accessToken, refreshToken } = await this.generateTokens(
        result.user.id,
        result.tenant.id,
        'ADMIN'
      );

      // Audit log for tenant registration (MEDIUM #20)
      await this.auditService.log({
        tenantId: result.tenant.id,
        userId: result.user.id,
        action: 'REGISTER_TENANT',
        resource: 'TENANT',
        resourceId: result.tenant.id,
        metadata: {
          tenantName: result.tenant.name,
          adminEmail: result.user.email,
        },
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
        },
      };
    } catch (error) {
      // Handle Prisma unique constraint violation (P2002)
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('User with this email already exists');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { tenant: true },
    });

    // SECURITY: Always run bcrypt.compare to prevent timing attacks
    // Use a dummy hash if user doesn't exist to maintain constant time
    const hashToCompare = user?.passwordHash || '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; // Dummy hash
    const isPasswordValid = await bcrypt.compare(dto.password, hashToCompare);

    // Check both user existence and password validity
    if (!user || !isPasswordValid) {
      // Audit failed login attempt (MEDIUM #20)
      if (user) {
        await this.auditService.log({
          tenantId: user.tenantId,
          userId: user.id,
          action: 'LOGIN_FAILED',
          resource: 'USER',
          resourceId: user.id,
          metadata: {
            reason: 'Invalid password',
            email: dto.email,
          },
        });
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate access and refresh tokens (HIGH #12, MEDIUM #25)
    const { accessToken, refreshToken } = await this.generateTokens(
      user.id,
      user.tenantId,
      user.role
    );

    // Audit successful login (MEDIUM #20)
    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      resource: 'USER',
      resourceId: user.id,
      metadata: {
        email: user.email,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
      },
    };
  }

  /**
   * Generate both access and refresh tokens (HIGH #12, MEDIUM #25)
   */
  private async generateTokens(userId: string, tenantId: string, role: string) {
    const payload = {
      sub: userId,
      tenantId,
      role,
    };

    // Access token: Short-lived (15 minutes)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    // Refresh token: Long-lived (7 days), stored in database
    const refreshToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Refresh access token using refresh token (MEDIUM #25)
   */
  async refreshAccessToken(refreshToken: string) {
    // Find refresh token in database
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: {
            tenant: true,
          },
        },
      },
    });

    // Check if token exists, not revoked, and not expired
    if (!tokenRecord || tokenRecord.isRevoked || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Generate new access token
    const payload = {
      sub: tokenRecord.user.id,
      tenantId: tokenRecord.user.tenantId,
      role: tokenRecord.user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    // Audit token refresh (MEDIUM #20)
    await this.auditService.log({
      tenantId: tokenRecord.user.tenantId,
      userId: tokenRecord.user.id,
      action: 'TOKEN_REFRESH',
      resource: 'USER',
      resourceId: tokenRecord.user.id,
    });

    return {
      accessToken,
      user: {
        id: tokenRecord.user.id,
        email: tokenRecord.user.email,
        role: tokenRecord.user.role,
      },
      tenant: {
        id: tokenRecord.user.tenant.id,
        name: tokenRecord.user.tenant.name,
      },
    };
  }

  /**
   * Revoke refresh token (logout)
   */
  async revokeRefreshToken(refreshToken: string) {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (tokenRecord) {
      await this.prisma.refreshToken.update({
        where: { token: refreshToken },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });

      // Audit logout (MEDIUM #20)
      await this.auditService.log({
        tenantId: tokenRecord.user.tenantId,
        userId: tokenRecord.user.id,
        action: 'LOGOUT',
        resource: 'USER',
        resourceId: tokenRecord.user.id,
      });
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }

  async validateUser(userId: string): Promise<(User & { tenant: Tenant }) | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
  }
}
