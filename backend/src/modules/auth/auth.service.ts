import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, Tenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private geminiService: GeminiService,
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

      // Generate JWT
      const token = this.generateToken(result.user.id, result.tenant.id, 'ADMIN');

      return {
        token,
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
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT
    const token = this.generateToken(user.id, user.tenantId, user.role);

    return {
      token,
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

  private generateToken(userId: string, tenantId: string, role: string): string {
    const payload = {
      sub: userId,
      tenantId,
      role,
    };

    return this.jwtService.sign(payload);
  }

  async validateUser(userId: string): Promise<(User & { tenant: Tenant }) | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
  }
}
