import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  databaseConfig,
  redisConfig,
  jwtConfig,
  geminiConfig,
  appConfig,
} from './config/env.config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { VendorsModule } from './modules/vendors/vendors.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, jwtConfig, geminiConfig, appConfig],
      envFilePath: '../.env',
    }),
    PrismaModule,
    AuthModule,
    VendorsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
