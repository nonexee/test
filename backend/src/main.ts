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

  // Security middleware - Helmet with Content Security Policy
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for Tailwind
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow embedding for Swagger UI
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Cookie parser middleware (CRITICAL for httpOnly cookies - HIGH #12)
  app.use(cookieParser());

  // Enable CORS with strict validation for multiple environments
  const isProduction = process.env.NODE_ENV === 'production';

  // Support multiple frontend URLs (production, staging, etc.)
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_STAGING,
    process.env.FRONTEND_URL_PREVIEW,
  ].filter(Boolean); // Remove undefined/null values

  // Add localhost for development
  if (!isProduction) {
    allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }

  if (isProduction && allowedOrigins.length === 0) {
    throw new Error(
      'At least one FRONTEND_URL environment variable is required in production for CORS configuration'
    );
  }

  if (allowedOrigins.length === 0) {
    console.warn(
      '⚠️  WARNING: No FRONTEND_URL set. Using default localhost origins'
    );
    allowedOrigins.push('http://localhost:3000');
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS blocked origin: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
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
  console.log(`📝 CORS allowed origins: ${allowedOrigins.join(', ')}`);
}

bootstrap();
