/**
 * Centralized Type Definitions for VendorFlow AI
 * Fixes GAP #6 - No centralized type definitions
 */

// ============================================================================
// ENUMS (matching Prisma schema)
// ============================================================================

export type UserRole = 'ADMIN' | 'VIEWER';

export type VendorType = 'SAAS' | 'CLOUD_INFRA' | 'CONSULTING' | 'AI_SERVICE' | 'OTHER';

export type VendorCriticality = 'LOW' | 'MEDIUM' | 'HIGH';

export type VendorStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED';

export type DocumentType = 'CONTRACT' | 'DPA' | 'SOC2' | 'SECURITY_WHITEPAPER' | 'AI_DOC' | 'OTHER';

export type ImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type ExtractionJobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'ERROR';

// ============================================================================
// CORE ENTITIES
// ============================================================================

export interface User {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  geminiFileSearchStoreName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  type: VendorType;
  criticality: VendorCriticality;
  status: VendorStatus;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

export interface VendorDocument {
  id: string;
  fileName: string;
  fileType: DocumentType;
  uploadedAt: string;
  geminiFileNameOrId: string;
  vendorId: string;
  uploadedByUserId: string;
  uploadedBy: {
    email: string;
  };
}

export interface SubProcessor {
  name: string;
  region: string;
  role: string;
}

export interface RegulatoryRelevance {
  dora: boolean;
  nis2: boolean;
  ai_act: boolean;
}

export interface VendorFacts {
  vendorId: string;
  dataCategories: string[];
  regions: string[];
  subProcessors: SubProcessor[];
  servicesSupported: string;
  businessFunctions: string;
  securityHighlights: string;
  impactIfCompromised: ImpactLevel;
  regulatoryRelevance: RegulatoryRelevance;
  lastExtractionAt?: string;
  extractionConfidence?: number;
}

export interface ExtractionJob {
  id: string;
  status: ExtractionJobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  rawLlmOutput?: Record<string, unknown>;
  errorMessage?: string;
  vendorId: string;
  tenantId: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: {
    email: string;
    role: UserRole;
  };
}

// ============================================================================
// COMPOSITE / VIEW TYPES
// ============================================================================

/**
 * Vendor with additional metadata for list views
 */
export interface VendorListItem extends Vendor {
  hasFacts: boolean;
  documentCount: number;
  _count?: {
    documents: number;
  };
}

/**
 * Vendor detail with all relations
 */
export interface VendorDetail extends Vendor {
  documents: VendorDocument[];
  facts?: VendorFacts;
  extractionJobs?: ExtractionJob[];
  extractionJobsMetadata?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Vendor with facts for DORA compliance view
 */
export interface DoraVendor extends Vendor {
  facts?: VendorFacts;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterTenantRequest {
  tenantName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface AuthResponse {
  user: User;
  tenant: Tenant;
  // Note: tokens are in httpOnly cookies, not in response body
}

export interface CreateVendorRequest {
  name: string;
  type: VendorType;
  criticality: VendorCriticality;
  status?: VendorStatus;
}

export interface UpdateVendorRequest {
  name?: string;
  type?: VendorType;
  criticality?: VendorCriticality;
  status?: VendorStatus;
}

export interface UploadDocumentRequest {
  fileType: DocumentType;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
  timestamp?: string;
  path?: string;
}

// ============================================================================
// STATISTICS & ANALYTICS
// ============================================================================

export interface AuditStatistics {
  totalActions: number;
  actionBreakdown: Array<{
    action: string;
    count: number;
  }>;
  resourceBreakdown: Array<{
    resource: string;
    count: number;
  }>;
}

export interface ExtractionJobMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// FILTER OPTIONS
// ============================================================================

export interface VendorFilterOptions {
  type?: VendorType;
  criticality?: VendorCriticality;
  search?: string;
  includeFacts?: boolean;
}

export interface AuditLogFilterOptions {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// FORM STATE TYPES
// ============================================================================

export interface VendorFormState {
  name: string;
  type: VendorType;
  criticality: VendorCriticality;
  status: VendorStatus;
}

export interface DocumentUploadState {
  file: File | null;
  fileType: DocumentType;
  uploading: boolean;
  progress: number;
  error?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

export interface PaginationConfig {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
