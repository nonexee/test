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

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"

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

### Phase 2: 🔄 Database Schema
- [ ] Prisma schema with all entities
- [ ] Database migrations

### Phase 3: 🔄 Authentication & CRUD
- [ ] JWT authentication
- [ ] Multi-tenant guard/middleware
- [ ] Vendor CRUD endpoints

### Phase 4: 🔄 AI Integration
- [ ] Gemini File Search service
- [ ] Document upload to Gemini
- [ ] Background extraction jobs
- [ ] Facts extraction with AI
- [ ] Supporting snippets ("show sources")

### Phase 5: 🔄 Frontend UI
- [ ] Authentication UI
- [ ] Vendors list with filters
- [ ] Vendor detail page
- [ ] DORA compliance register
- [ ] Document upload UI
- [ ] Extraction trigger & status

### Phase 6: 🔄 Testing & Polish
- [ ] Backend integration tests
- [ ] Frontend component tests
- [ ] Security audit
- [ ] Production-ready documentation

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

Documentation for API endpoints will be generated as they are implemented.

### Planned Endpoints

- `POST /api/auth/register-tenant` - Register new tenant
- `POST /api/auth/login` - User login
- `GET /api/vendors` - List vendors (with filters)
- `POST /api/vendors` - Create vendor
- `GET /api/vendors/:id` - Get vendor details
- `PATCH /api/vendors/:id` - Update vendor
- `DELETE /api/vendors/:id` - Delete vendor
- `POST /api/vendors/:id/documents` - Upload document
- `POST /api/vendors/:id/extract` - Trigger extraction
- `POST /api/vendors/:id/sources` - Get supporting snippets
- `GET /api/compliance/dora` - Get DORA register

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

## Security Considerations

- All secrets in environment variables, never committed
- JWT tokens for authentication
- Multi-tenant data isolation enforced at query level
- Input validation on all API endpoints
- CORS configured for frontend origin
- File upload validation (type, size)

## Contributing

This is a production application. Follow these guidelines:

1. Keep code modular and well-typed
2. Add proper error handling and logging
3. Write tests for new features
4. Update documentation as needed
5. Follow the existing code style

## License

Proprietary - All rights reserved
