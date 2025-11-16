import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security middleware - Helmet
  app.use(helmet());

  // Enable CORS with strict validation
  const frontendUrl = process.env.FRONTEND_URL;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && !frontendUrl) {
    throw new Error(
      'FRONTEND_URL environment variable is required in production for CORS configuration'
    );
  }

  const corsOrigin = frontendUrl || 'http://localhost:3000';

  if (!frontendUrl) {
    console.warn(
      '⚠️  WARNING: FRONTEND_URL not set. Using default http://localhost:3000'
    );
  }

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get<number>('app.port') || 3001;
  await app.listen(port);

  console.log(`🚀 VendorFlow AI Backend running on: http://localhost:${port}`);
  console.log(`📝 CORS origin: ${corsOrigin}`);
}

bootstrap();
