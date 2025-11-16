import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security middleware - Helmet
  app.use(helmet());

  // Cookie parser middleware (CRITICAL for httpOnly cookies - HIGH #12)
  app.use(cookieParser());

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

  // Swagger/OpenAPI documentation (MEDIUM #28)
  const config = new DocumentBuilder()
    .setTitle('VendorFlow AI API')
    .setDescription('Multi-tenant SaaS platform for AI-powered vendor risk assessment and compliance management')
    .setVersion('1.0')
    .addTag('auth', 'Authentication and tenant registration')
    .addTag('vendors', 'Vendor management and CRUD operations')
    .addTag('documents', 'Document upload and management')
    .addTag('extraction', 'AI-powered fact extraction')
    .addTag('compliance', 'DORA/NIS2/AI Act compliance')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from /auth/login endpoint',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'VendorFlow AI API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = configService.get<number>('app.port') || 3001;
  await app.listen(port);

  console.log(`🚀 VendorFlow AI Backend running on: http://localhost:${port}`);
  console.log(`📝 API Documentation: http://localhost:${port}/api/docs`);
  console.log(`📝 CORS origin: ${corsOrigin}`);
}

bootstrap();
