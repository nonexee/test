# VendorFlow AI

A production-grade, multi-tenant SaaS application for managing vendor compliance registers with AI-powered document extraction.

## Overview

VendorFlow AI helps organizations build and maintain a structured register of third-party ICT/SaaS/AI vendors by:

- Managing vendor information and documents
- Extracting structured data using Google Gemini AI and File Search
- Tracking compliance with DORA, NIS2, and EU AI Act regulations
- Generating compliance reports and exports

## Architecture

### Tech Stack

- **Backend**: Node.js 20+, NestJS, TypeScript
- **Frontend**: Next.js 15+, React, TypeScript, Tailwind CSS
- **Database**: PostgreSQL (via Prisma ORM)
- **Queue/Jobs**: Redis + BullMQ
- **AI/RAG**: Google Gemini API with File Search
- **Auth**: JWT-based authentication

### Core Entities

- **Tenant**: Multi-tenant organization
- **User**: Users within a tenant (ADMIN or VIEWER roles)
- **Vendor**: Third-party vendors being tracked
- **VendorDocument**: Documents uploaded for each vendor
- **VendorFacts**: AI-extracted structured data about vendors
- **ExtractionJob**: Background jobs for AI extraction

## Getting Started

### Prerequisites

- Node.js 20+ and npm 10+
- Docker and Docker Compose
- Google Gemini API key (for AI features)

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd test
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and add your configuration:

```env
# Database
DATABASE_URL="postgresql://vendorflow:vendorflow_dev_password@localhost:5432/vendorflow?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT (IMPORTANT: JWT_SECRET must be at least 32 characters long)
JWT_SECRET="your-super-secret-jwt-key-change-in-production-min-32-chars"
JWT_EXPIRES_IN="1h"

# Gemini AI
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_PROJECT_ID="your-gcp-project-id"
GEMINI_LOCATION="us-central1"

# Application
NODE_ENV="development"
PORT=3001

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

**Important**: The JWT_SECRET must be at least 32 characters long for security. The application will fail to start if this requirement is not met.

4. **Start infrastructure (PostgreSQL + Redis)**

```bash
npm run docker:up
```

To stop:

```bash
npm run docker:down
```

5. **Run database migrations**

```bash
npm run migrate:dev
```

6. **Start development servers**

In separate terminals, or use the combined command:

```bash
# Start both backend and frontend
npm run dev

# Or start individually:
npm run dev:backend
npm run dev:frontend
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api

### Database Management

```bash
# Create a new migration
npm run migrate:dev

# Apply migrations (production)
npm run migrate

# Reset database (WARNING: deletes all data)
npm run migrate:reset

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

## Project Structure

```
.
├── backend/                 # NestJS backend application
│   ├── src/
│   │   ├── modules/        # Feature modules (auth, vendors, etc.)
│   │   ├── common/         # Shared guards, decorators, filters
│   │   ├── config/         # Configuration files
│   │   ├── app.module.ts   # Root application module
│   │   └── main.ts         # Application entry point
│   └── package.json
│
├── frontend/               # Next.js frontend application
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   ├── components/    # React components
│   │   ├── lib/          # Utilities and API client
│   │   ├── hooks/        # Custom React hooks
│   │   └── types/        # TypeScript type definitions
│   └── package.json
│
├── prisma/                # Database schema and migrations
│   └── schema.prisma
│
├── docker-compose.yml     # Local development infrastructure
├── .env.example          # Environment variables template
└── package.json          # Root workspace configuration
```

## Features (Implementation Status)

### Phase 1: ✅ Bootstrap (Complete)
- [x] Monorepo structure
- [x] Backend scaffolding (NestJS)
- [x] Frontend scaffolding (Next.js 15)
- [x] Docker Compose setup
- [x] Basic documentation

### Phase 2: ✅ Database Schema (Complete)
- [x] Prisma schema with all 6 entities (Tenant, User, Vendor, VendorDocument, VendorFacts, ExtractionJob)
- [x] Database migrations with composite indexes for performance
- [x] Multi-tenant data model with tenant scoping

### Phase 3: ✅ Authentication & CRUD (Complete)
- [x] JWT authentication with Passport
- [x] Multi-tenant guard/middleware with tenant isolation
- [x] Vendor CRUD endpoints (create, read, update, delete)
- [x] Security features: rate limiting, Helmet, bcrypt (12 rounds), password complexity validation
- [x] Defense-in-depth: timing attack prevention, race condition handling, magic byte file validation

### Phase 4: ✅ AI Integration (Complete)
- [x] Gemini AI service with File Search integration
- [x] Document upload to Gemini FileSearchStore
- [x] BullMQ background job queue for extraction
- [x] Extraction processor/worker with progress tracking
- [x] Facts extraction with structured output
- [x] Supporting snippets endpoint ("show sources")
- [x] Automatic extraction triggering on document upload

### Phase 5: ✅ Frontend UI (Complete)
- [x] Authentication UI (login/register with validation)
- [x] Vendors list with filters (type, criticality, search)
- [x] Vendor detail page with document management
- [x] DORA compliance register with CSV export
- [x] Document upload UI with file type validation
- [x] Extraction trigger & status display
- [x] Show sources feature for extracted facts
- [x] AuthProvider context for global auth state

### Phase 6: ⚠️ Testing & Polish (Partial)
- [ ] Backend integration tests
- [ ] Frontend component tests
- [x] Security audit completed with all critical issues resolved
- [x] Production-ready documentation

## Multi-Tenancy

VendorFlow AI is built with multi-tenancy at its core:

- Every data record is scoped by `tenant_id`
- Access control enforced at the API level via JWT
- Each tenant has its own Gemini FileSearchStore
- Users cannot access data from other tenants

## AI Extraction Process

1. **Document Upload**: Documents (contracts, DPAs, SOC2 reports, etc.) are uploaded and stored in the tenant's Gemini FileSearchStore
2. **Trigger Extraction**: User initiates extraction for a vendor
3. **Background Job**: BullMQ worker processes the extraction using Gemini's File Search
4. **Structured Output**: AI extracts:
   - Data categories processed
   - Geographic regions
   - Sub-processors
   - Security highlights
   - Regulatory relevance (DORA, NIS2, AI Act)
5. **Storage**: Results saved as VendorFacts for quick access
6. **Sources**: Users can view supporting document snippets for any extracted fact

## API Endpoints

All endpoints are prefixed with the backend URL (default: `http://localhost:3001`).

### Authentication

- `POST /auth/register-tenant` - Register new tenant and admin user
  - Body: `{ tenantName, adminEmail, adminPassword }`
  - Returns: `{ token, user, tenant }`

- `POST /auth/login` - User login
  - Body: `{ email, password }`
  - Returns: `{ token, user, tenant }`

### Vendors (All require authentication via `Authorization: Bearer <token>`)

- `GET /vendors` - List all vendors for the tenant
  - Query params: `type`, `criticality`, `search`
  - Returns: Array of vendor summaries with hasFacts and documentCount

- `POST /vendors` - Create a new vendor
  - Body: `{ name, type, criticality }`
  - Returns: Created vendor object

- `GET /vendors/:id` - Get vendor details
  - Returns: Vendor with documents, facts, and extraction jobs

- `PATCH /vendors/:id` - Update vendor
  - Body: Partial vendor fields
  - Returns: Updated vendor object

- `DELETE /vendors/:id` - Delete vendor
  - Returns: Success message

- `POST /vendors/:id/documents` - Upload document (multipart/form-data)
  - Body: `file` (multipart), `fileType` (form field)
  - Accepted types: PDF, DOCX, DOC, TXT, CSV, XLS, XLSX
  - Max size: 10MB
  - Returns: Created document object
  - Note: Automatically triggers extraction job

- `POST /vendors/:id/extract` - Manually trigger extraction
  - Returns: Created extraction job object

- `GET /vendors/:id/sources` - Get supporting snippets for a statement
  - Query param: `statement` (required)
  - Returns: Array of source snippets from documents

## Development Scripts

```bash
# Development
npm run dev                 # Start both backend and frontend
npm run dev:backend        # Start backend only
npm run dev:frontend       # Start frontend only

# Build
npm run build              # Build both projects
npm run build:backend      # Build backend only
npm run build:frontend     # Build frontend only

# Database
npm run migrate            # Run migrations (production)
npm run migrate:dev        # Run migrations (development)
npm run migrate:reset      # Reset database
npm run prisma:studio      # Open Prisma Studio

# Docker
npm run docker:up          # Start PostgreSQL + Redis
npm run docker:down        # Stop containers
npm run docker:logs        # View container logs

# Testing
npm run test               # Run all tests
npm run lint               # Lint all code
npm run format             # Format code with Prettier
```

## Security Features

VendorFlow AI implements comprehensive security measures:

### Authentication & Authorization
- **JWT-based authentication** with 1-hour token expiry
- **Bcrypt password hashing** with 12 rounds
- **Password complexity validation** (min 8 chars, uppercase, lowercase, number/special char)
- **JWT secret validation** (minimum 32 characters enforced at startup)

### Multi-Tenant Security
- **Defense-in-depth**: Tenant isolation enforced at database query level using compound WHERE clauses
- **Tenant scoping**: All queries use `where: { id, tenantId }` to prevent cross-tenant access
- **JWT tenant claims**: Tenant ID embedded in JWT and validated on every request

### Attack Prevention
- **Timing attack prevention**: Constant-time login (always runs bcrypt even for non-existent users)
- **Race condition handling**: Registration uses database transactions with unique constraint error handling
- **File upload security**: Magic byte validation prevents CVE-2024-29409 (file extension spoofing)
- **Rate limiting**: Global (100 req/min) and endpoint-specific limits (3 registrations/min, 5 logins/min)

### Data Protection
- **Input validation**: Class-validator DTOs on all endpoints
- **Environment validation**: Type-safe environment variables validated at startup
- **CORS configuration**: Restricted to frontend origin
- **Helmet middleware**: Security headers (XSS protection, HSTS, etc.)
- **File size limits**: 10MB maximum for document uploads

### Best Practices
- All secrets in environment variables, never committed
- Type-safe throughout (no `any` types in production code)
- Proper error handling with type guards
- SQL injection prevention via Prisma ORM

## Production Deployment

### Prerequisites for Production

- Node.js 20+ LTS
- PostgreSQL 14+ (managed service recommended)
- Redis 7+ (managed service recommended)
- Google Gemini API key with File Search access
- SSL certificates for HTTPS
- Domain name configured

### Environment Configuration

Create a production `.env` file with:

```env
# Database (use managed PostgreSQL service URL)
DATABASE_URL="postgresql://user:password@prod-db-host:5432/vendorflow?schema=public&sslmode=require"

# Redis (use managed Redis service URL)
REDIS_URL="redis://user:password@prod-redis-host:6379"

# JWT (generate a strong 64+ character random string)
JWT_SECRET="<generate-a-strong-random-string-minimum-32-chars-recommended-64>"
JWT_EXPIRES_IN="1h"

# Gemini AI
GEMINI_API_KEY="<your-production-gemini-api-key>"
GEMINI_PROJECT_ID="<your-gcp-project-id>"
GEMINI_LOCATION="us-central1"

# Application
NODE_ENV="production"
PORT=3001

# Frontend (use your production domain)
NEXT_PUBLIC_API_URL="https://api.yourdomain.com"
```

### Build and Deploy

1. **Install dependencies**:
   ```bash
   npm install --production
   ```

2. **Build both applications**:
   ```bash
   npm run build
   ```

3. **Run database migrations**:
   ```bash
   npm run migrate
   ```

4. **Start the applications**:

   **Backend**:
   ```bash
   cd backend
   npm run start:prod
   ```

   **Frontend** (using a process manager like PM2):
   ```bash
   cd frontend
   pm2 start npm --name "vendorflow-frontend" -- start
   ```

### Recommended Deployment Architecture

- **Reverse Proxy**: Nginx or Cloudflare for SSL termination and caching
- **Backend**: Deploy on VPS/container with PM2 or Docker
- **Frontend**: Deploy on Vercel, Netlify, or self-hosted Next.js server
- **Database**: Managed PostgreSQL (AWS RDS, Google Cloud SQL, Supabase)
- **Redis**: Managed Redis (AWS ElastiCache, Redis Cloud, Upstash)
- **Queue Worker**: Run extraction worker as separate process with PM2

### Queue Worker Deployment

The extraction worker should run as a separate process:

```bash
cd backend
pm2 start npm --name "vendorflow-worker" -- run worker:extraction
```

### Health Checks

- Backend: `GET http://localhost:3001/` (returns 404 but confirms server running)
- Database: Ensure migrations applied successfully
- Redis: Worker should connect and process jobs

### Security Checklist for Production

- [ ] JWT_SECRET is 64+ characters and randomly generated
- [ ] Database uses SSL connections (`sslmode=require`)
- [ ] Redis uses password authentication
- [ ] CORS restricted to production frontend domain only
- [ ] Rate limiting enabled (default: 100 req/min)
- [ ] Helmet middleware active with security headers
- [ ] Environment variables never committed to git
- [ ] File upload size limits enforced (10MB)
- [ ] HTTPS enforced for all traffic
- [ ] Regular security updates for dependencies

### Monitoring Recommendations

- **Application**: Use logging service (Sentry, LogRocket)
- **Infrastructure**: Monitor CPU, memory, disk usage
- **Database**: Monitor connection pool, query performance
- **Queue**: Monitor job success/failure rates, queue length

## Contributing

This is a production application. Follow these guidelines:

1. Keep code modular and well-typed
2. Add proper error handling and logging
3. Write tests for new features
4. Update documentation as needed
5. Follow the existing code style

## License

Proprietary - All rights reserved
