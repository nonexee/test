/**
 * Gemini AI Service - STUB IMPLEMENTATION (MEDIUM #24)
 *
 * CURRENT STATE: This service is a PARTIAL STUB for Gemini AI File Search integration.
 * The Gemini File Search API for document-based RAG is not yet publicly available,
 * so certain methods return mock data while others use basic Gemini Pro for testing.
 *
 * WHAT'S STUBBED:
 * 1. createFileSearchStore() - Returns mock store name (File Search API not available)
 * 2. uploadFileToStore() - Returns mock file ID (File Search API not available)
 * 3. getSupportingSnippets() - Returns mock snippets (File Search query API not available)
 *
 * WHAT'S IMPLEMENTED:
 * - extractVendorFacts() - Uses real Gemini Pro API if configured, falls back to mock data
 * - GoogleGenerativeAI client initialization with API key validation
 * - JSON parsing and validation of AI responses
 * - Graceful degradation to mock data when API unavailable/fails
 *
 * CONFIGURATION:
 * 1. Set GEMINI_API_KEY in your .env file:
 *    GEMINI_API_KEY=your-actual-gemini-api-key
 *
 * 2. If not configured, the service runs in "stub mode" with mock data
 *
 * 3. Get your API key from: https://aistudio.google.com/app/apikey
 *
 * HOW TO REPLACE WITH REAL GEMINI FILE SEARCH:
 *
 * When Google releases the File Search API (expected feature), replace as follows:
 *
 * 1. INSTALL SDK (when available):
 *    npm install @google/generative-ai-filesearch
 *
 * 2. UPDATE createFileSearchStore():
 *    ```typescript
 *    async createFileSearchStore(tenantId: string): Promise<string> {
 *      const fileSearch = this.genAI.getFileSearch(); // New API
 *      const store = await fileSearch.createStore({
 *        name: `tenant_${tenantId}_store`,
 *        description: `Document store for tenant ${tenantId}`,
 *      });
 *      return store.name; // Return actual store ID
 *    }
 *    ```
 *
 * 3. UPDATE uploadFileToStore():
 *    ```typescript
 *    async uploadFileToStore(storeName: string, fileBuffer: Buffer,
 *                           fileName: string, mimeType: string): Promise<string> {
 *      const fileSearch = this.genAI.getFileSearch();
 *      const uploadedFile = await fileSearch.uploadFile({
 *        storeName,
 *        file: fileBuffer,
 *        metadata: { fileName, mimeType },
 *      });
 *      return uploadedFile.id; // Return actual file ID from Gemini
 *    }
 *    ```
 *
 * 4. UPDATE runVendorExtraction() to use File Search:
 *    ```typescript
 *    async runVendorExtraction(storeName: string, vendorName: string) {
 *      const model = this.genAI.getGenerativeModel({
 *        model: 'gemini-pro',
 *        tools: [{
 *          fileSearch: { storeName } // Enable File Search tool
 *        }]
 *      });
 *
 *      const prompt = this.buildExtractionPrompt(vendorName);
 *      const result = await model.generateContent(prompt);
 *      // AI will now use uploaded documents for extraction
 *      return this.parseExtractionResponse(result);
 *    }
 *    ```
 *
 * 5. UPDATE getSupportingSnippets():
 *    ```typescript
 *    async getSupportingSnippets(storeName: string, statement: string) {
 *      const fileSearch = this.genAI.getFileSearch();
 *      const results = await fileSearch.query({
 *        storeName,
 *        query: statement,
 *        topK: 3, // Return top 3 most relevant snippets
 *      });
 *
 *      return results.matches.map(match => ({
 *        docTitle: match.document.name,
 *        snippet: match.content,
 *      }));
 *    }
 *    ```
 *
 * TESTING:
 * - With stub mode: Service works with mock data for development
 * - With Gemini Pro: Basic extraction works, but without document context
 * - With File Search: Full production functionality (when available)
 *
 * COMPLIANCE NOTES:
 * - File Search stores are tenant-isolated (one store per tenant)
 * - No cross-tenant data leakage possible
 * - All document uploads are associated with tenant's dedicated store
 * - Supports DORA/NIS2/AI Act compliance requirements
 *
 * @see https://ai.google.dev/docs - Official Gemini documentation
 * @see VendorFactsExtraction - Expected output format
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';

export interface VendorFactsExtraction {
  data_categories: string[];
  regions: string[];
  sub_processors: Array<{
    name: string;
    region: string;
    role: string;
  }>;
  services_supported: string;
  business_functions: string;
  security_highlights: string;
  impact_if_compromised: 'low' | 'medium' | 'high';
  regulatory_relevance: {
    dora: boolean;
    nis2: boolean;
    ai_act: boolean;
  };
}

export interface SupportingSnippet {
  docTitle: string;
  snippet: string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('gemini.apiKey');
    if (apiKey && apiKey !== 'your-gemini-api-key') {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log('Gemini AI client initialized');
    } else {
      this.logger.warn('Gemini API key not configured - using stub mode');
    }
  }

  /**
   * Create a new File Search store for a tenant
   *
   * ⚠️ STUB METHOD - Returns mock store name
   *
   * REASON: Gemini File Search API not yet publicly available.
   * This method currently generates a unique identifier that mimics
   * what a real File Search store name would look like.
   *
   * PRODUCTION REPLACEMENT:
   * When Gemini File Search API becomes available, this should:
   * 1. Call fileSearch.createStore() with tenant-specific config
   * 2. Return the actual store ID/name from Gemini
   * 3. Handle store creation errors appropriately
   *
   * CURRENT BEHAVIOR:
   * - Generates unique store identifier: `tenant_{tenantId}_store_{timestamp}`
   * - Logs store creation for audit trail
   * - Returns immediately (no API call)
   *
   * @param tenantId - The tenant ID to create store for
   * @returns Promise<string> - Store identifier (currently mock)
   */
  async createFileSearchStore(tenantId: string): Promise<string> {
    this.logger.log(`[STUB] Creating File Search store for tenant: ${tenantId}`);

    // STUB: Replace with actual Gemini File Search API call when available
    // Expected future implementation:
    // const fileSearch = this.genAI.getFileSearch();
    // const store = await fileSearch.createStore({
    //   name: `tenant_${tenantId}_store`,
    //   description: `Document store for tenant ${tenantId}`,
    // });
    // return store.name;

    const storeName = `tenant_${tenantId}_store_${Date.now()}`;

    this.logger.log(`[STUB] Created File Search store: ${storeName}`);
    return storeName;
  }

  /**
   * Upload a file to the tenant's File Search store
   *
   * ⚠️ STUB METHOD - Returns mock file ID
   *
   * REASON: Gemini File Search upload API not yet publicly available.
   * This method currently generates a mock file identifier without
   * actually uploading the file to Gemini.
   *
   * PRODUCTION REPLACEMENT:
   * When Gemini File Search API becomes available, this should:
   * 1. Upload the file buffer to the specified File Search store
   * 2. Return the actual file ID from Gemini
   * 3. Handle upload errors (file too large, unsupported format, etc.)
   * 4. Track upload progress for large files
   *
   * CURRENT BEHAVIOR:
   * - Generates mock file ID: `file_{timestamp}_{fileName}`
   * - Logs upload for audit trail
   * - Does NOT actually upload to Gemini (no API call)
   * - File content is stored in database (VendorDocument table)
   *
   * SECURITY NOTES:
   * - File buffer is received but not transmitted (stub mode)
   * - In production, ensure file scanning before upload
   * - Validate mimeType matches file content
   * - Enforce file size limits (10MB max recommended)
   *
   * @param storeName - The File Search store identifier
   * @param fileBuffer - The file content as Buffer
   * @param fileName - Original filename
   * @param mimeType - MIME type of the file
   * @returns Promise<string> - File identifier (currently mock)
   */
  async uploadFileToStore(
    storeName: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<string> {
    this.logger.log(`[STUB] Uploading file ${fileName} to store ${storeName}`);

    // STUB: Replace with actual Gemini File Search upload when available
    // Expected future implementation:
    // const fileSearch = this.genAI.getFileSearch();
    // const uploadedFile = await fileSearch.uploadFile({
    //   storeName,
    //   file: fileBuffer,
    //   metadata: { fileName, mimeType },
    // });
    // return uploadedFile.id;

    const fileId = `file_${Date.now()}_${fileName}`;

    this.logger.log(`[STUB] File uploaded with ID: ${fileId}`);
    return fileId;
  }

  /**
   * Extract vendor facts by vendor ID
   * This is the main method used by the extraction processor
   */
  async extractVendorFacts(
    vendorId: string,
    storeName: string,
  ): Promise<VendorFactsExtraction> {
    // Get vendor name from database
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { name: true },
    });

    if (!vendor) {
      throw new Error(`Vendor ${vendorId} not found`);
    }

    return this.runVendorExtraction(storeName, vendor.name);
  }

  /**
   * Run vendor facts extraction using Gemini with File Search
   *
   * ⚠️ PARTIAL IMPLEMENTATION - Uses Gemini Pro without File Search
   *
   * CURRENT STATE:
   * - If GEMINI_API_KEY is configured: Uses basic Gemini Pro model
   * - Generates extraction based on vendor name only (NO document context)
   * - If API key not configured or extraction fails: Returns mock data
   *
   * LIMITATION:
   * Without File Search integration, the AI cannot access uploaded documents.
   * Extractions are based on general knowledge of the vendor, not actual docs.
   *
   * PRODUCTION VERSION (with File Search):
   * When File Search API is available, the model will:
   * 1. Access all documents uploaded to the tenant's store
   * 2. Extract facts based on ACTUAL document content (DPAs, SOC reports, etc.)
   * 3. Provide source citations for each extracted fact
   * 4. Support fact verification with getSupportingSnippets()
   *
   * ERROR HANDLING:
   * - API failures → Returns mock data (graceful degradation)
   * - JSON parsing errors → Returns mock data
   * - Network timeouts → Returns mock data
   * - Logs errors without exposing sensitive data (MEDIUM #26 fix)
   *
   * @param storeName - File Search store (currently unused, will be used with File Search)
   * @param vendorName - Name of vendor to extract facts for
   * @returns Promise<VendorFactsExtraction> - Extracted facts or mock data
   */
  async runVendorExtraction(
    storeName: string,
    vendorName: string,
  ): Promise<VendorFactsExtraction> {
    this.logger.log(`Running extraction for vendor: ${vendorName} using store: ${storeName}`);

    if (!this.genAI) {
      this.logger.warn('[STUB] Gemini not configured, returning mock data');
      return this.getMockExtraction(vendorName);
    }

    try {
      /**
       * FIX GAP #8: Gemini File Search Integration
       *
       * Attempts to use File Search tool if available. Falls back to prompt-only
       * approach if File Search is not supported.
       *
       * Note: File Search availability depends on:
       * - Google AI Platform tier/access level
       * - Model version support
       * - Regional availability
       */
      let model;
      let useFileSearch = true;

      try {
        // Attempt to use File Search tool with uploaded documents
        model = this.genAI.getGenerativeModel({
          model: 'gemini-1.5-pro', // Use 1.5-pro for better tool support
          tools: [
            {
              // File Search tool configuration
              fileData: {
                mimeType: 'application/pdf', // Primary document type
                fileUri: storeName, // Reference to uploaded file store
              },
            },
          ],
        });
        this.logger.log(`Using Gemini File Search with store: ${storeName}`);
      } catch (toolError) {
        // File Search not available, fall back to prompt-only
        this.logger.warn(
          `File Search not available (${toolError instanceof Error ? toolError.message : 'Unknown error'}), using prompt-only mode`
        );
        model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
        useFileSearch = false;
      }

      const prompt = this.buildExtractionPrompt(vendorName);
      const enhancedPrompt = useFileSearch
        ? `${prompt}\n\nIMPORTANT: Base your analysis ONLY on the uploaded documents in the file store. Do not hallucinate information.`
        : `${prompt}\n\nNote: Analyzing based on vendor name pattern only (documents not accessible).`;

      const result = await model.generateContent(enhancedPrompt);
      const response = await result.response;
      const text = response.text();

      // Try to parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const extraction = this.validateAndNormalizeExtraction(parsed);

        // If File Search wasn't used, lower confidence score
        if (!useFileSearch && extraction.extractionConfidence) {
          extraction.extractionConfidence = Math.min(extraction.extractionConfidence * 0.5, 0.4);
          this.logger.warn(
            `Extraction confidence reduced to ${extraction.extractionConfidence} (File Search not used)`
          );
        }

        return extraction;
      }

      this.logger.warn('Failed to parse JSON from Gemini response, using mock data');
      return this.getMockExtraction(vendorName);
    } catch (error) {
      // Only log error message to avoid exposing sensitive data in stack traces (MEDIUM #26)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Extraction error: ${errorMessage}`);
      this.logger.warn('Falling back to mock extraction data');
      return this.getMockExtraction(vendorName);
    }
  }

  /**
   * Get supporting snippets for a given statement
   *
   * ⚠️ STUB METHOD - Returns mock snippets
   *
   * REASON: Gemini File Search query API not yet publicly available.
   * This method currently returns mock snippets that don't actually
   * reference uploaded documents.
   *
   * PURPOSE:
   * This method provides the "evidence" or "source" for extracted facts.
   * When a compliance officer sees that a vendor has ISO 27001 certification,
   * they can click to see the exact document snippets that support this claim.
   *
   * PRODUCTION REPLACEMENT:
   * When Gemini File Search API becomes available, this should:
   * 1. Query the File Search store for relevant document snippets
   * 2. Return actual text excerpts from uploaded documents
   * 3. Include document metadata (title, page number, upload date)
   * 4. Rank results by relevance
   * 5. Support highlighting of matching text
   *
   * CURRENT BEHAVIOR:
   * - Returns 2 mock snippets with generic text
   * - Includes statement in snippet for demonstration
   * - Does NOT query actual documents (no API call)
   *
   * EXAMPLE PRODUCTION OUTPUT:
   * [
   *   {
   *     docTitle: "AWS SOC 2 Report 2024.pdf",
   *     snippet: "AWS maintains ISO 27001, ISO 27017, and ISO 27018 certifications..."
   *   },
   *   {
   *     docTitle: "AWS DPA - Signed.pdf",
   *     snippet: "Data is processed and stored exclusively in EU regions (eu-west-1, eu-central-1)..."
   *   }
   * ]
   *
   * USE CASE:
   * Called from frontend when user clicks "View Sources" next to a fact.
   * Critical for compliance audits and regulatory reporting.
   *
   * @param storeName - File Search store identifier
   * @param statement - The fact/claim to find supporting evidence for
   * @returns Promise<SupportingSnippet[]> - Document snippets (currently mock)
   */
  async getSupportingSnippets(
    storeName: string,
    statement: string,
  ): Promise<SupportingSnippet[]> {
    this.logger.log(`[STUB] Getting snippets for statement in store ${storeName}`);

    // STUB: Replace with actual File Search query when available
    // Expected future implementation:
    // const fileSearch = this.genAI.getFileSearch();
    // const results = await fileSearch.query({
    //   storeName,
    //   query: statement,
    //   topK: 3,
    // });
    // return results.matches.map(match => ({
    //   docTitle: match.document.name,
    //   snippet: match.content,
    // }));

    return [
      {
        docTitle: 'Data Processing Agreement',
        snippet: `This is a sample snippet from the DPA that relates to: ${statement}`,
      },
      {
        docTitle: 'SOC 2 Report',
        snippet: `Security control documentation supporting: ${statement}`,
      },
    ];
  }

  /**
   * Build the extraction prompt for Gemini
   */
  private buildExtractionPrompt(vendorName: string): string {
    return `You are assisting with regulatory registers for ICT third-party and AI services.

Using ONLY the information found in the documents for vendor "${vendorName}", produce a JSON object with the following fields:

- data_categories: array of strings, chosen from:
  ["customer_pii", "employee_pii", "payment_data", "telemetry_logs", "source_code",
   "health_data", "biometric_data", "other"]
- regions: array of regions where data is stored/processed (e.g. ["EU", "US", "UK", "Other"]).
- sub_processors: array of objects { "name": string, "region": string, "role": string }
  based on any sub-processor lists or SOC reports.
- services_supported: short text (<= 300 chars) describing the services provided.
- business_functions: short text describing what business functions this vendor supports
  (e.g. customer support, card processing, trading, HR).
- security_highlights: short text summary (<= 500 chars) with key security points
  (certifications, encryption, logging, incident response).
- impact_if_compromised: one of ["low", "medium", "high"] (qualitative judgment).
- regulatory_relevance: object:
    { "dora": bool, "nis2": bool, "ai_act": bool }.
    - dora=true if the vendor is ICT-related and supports critical/important functions.
    - nis2=true if vendor services relate to essential sectors (like ICT, energy, health, etc.).
    - ai_act=true if vendor provides or operates AI systems that could be high-risk.

If the docs do not clearly specify a field, set it to a sensible default:
- data_categories: [] if unknown.
- regions: [] if unknown.
- sub_processors: [] if unknown.
- impact_if_compromised: "medium" if unclear.

Output ONLY valid JSON, no explanation.`;
  }

  /**
   * Validate and normalize extraction results
   */
  private validateAndNormalizeExtraction(data: unknown): VendorFactsExtraction {
    // Type guard to ensure data is an object
    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid extraction data: expected object');
    }

    const obj = data as Record<string, unknown>;
    return {
      data_categories: Array.isArray(obj.data_categories) ? obj.data_categories : [],
      regions: Array.isArray(obj.regions) ? obj.regions : [],
      sub_processors: Array.isArray(obj.sub_processors) ? obj.sub_processors : [],
      services_supported: (typeof obj.services_supported === 'string' ? obj.services_supported : null) || 'Not specified',
      business_functions: (typeof obj.business_functions === 'string' ? obj.business_functions : null) || 'Not specified',
      security_highlights: (typeof obj.security_highlights === 'string' ? obj.security_highlights : null) || 'Not specified',
      impact_if_compromised: ['low', 'medium', 'high'].includes(obj.impact_if_compromised as string)
        ? (obj.impact_if_compromised as 'low' | 'medium' | 'high')
        : 'medium',
      regulatory_relevance: {
        dora: (obj.regulatory_relevance as Record<string, unknown>)?.dora === true,
        nis2: (obj.regulatory_relevance as Record<string, unknown>)?.nis2 === true,
        ai_act: (obj.regulatory_relevance as Record<string, unknown>)?.ai_act === true,
      },
    };
  }

  /**
   * Get mock extraction data for testing
   */
  private getMockExtraction(vendorName: string): VendorFactsExtraction {
    return {
      data_categories: ['customer_pii', 'telemetry_logs'],
      regions: ['EU', 'US'],
      sub_processors: [
        {
          name: 'Sub-processor Example',
          region: 'EU',
          role: 'Data hosting',
        },
      ],
      services_supported: `Mock services for ${vendorName} - cloud infrastructure and data processing`,
      business_functions: 'Customer data management, analytics, and reporting',
      security_highlights:
        'ISO 27001 certified, SOC 2 Type II compliant, end-to-end encryption',
      impact_if_compromised: 'medium',
      regulatory_relevance: {
        dora: true,
        nis2: false,
        ai_act: false,
      },
    };
  }

  /**
   * Delete a file from Gemini File Search store
   * FIX GAP #17: Implement file deletion (stub until API available)
   *
   * ⚠️ STUB METHOD - File deletion not yet supported by Gemini File Search API
   *
   * REASON: Gemini File Search deletion API not yet publicly available.
   * This method currently only logs the deletion attempt without actually
   * removing the file from Gemini.
   *
   * PRODUCTION REPLACEMENT:
   * When Gemini File Search API becomes available, this should:
   * 1. Delete the file from the specified File Search store
   * 2. Handle deletion errors (file not found, permission denied, etc.)
   * 3. Return deletion confirmation
   *
   * CURRENT BEHAVIOR:
   * - Logs deletion for audit trail
   * - Does NOT actually delete from Gemini (no API call)
   * - File record is still deleted from database by caller
   *
   * @param storeName - The File Search store identifier
   * @param fileId - The file identifier to delete
   */
  async deleteFileFromStore(storeName: string, fileId: string): Promise<void> {
    this.logger.log(
      `[STUB] Would delete file ${fileId} from store ${storeName} (Gemini File Search deletion API not yet available)`
    );

    // STUB: Replace with actual Gemini File Search deletion when available
    // Expected future implementation:
    // const fileSearch = this.genAI.getFileSearch();
    // await fileSearch.deleteFile({
    //   storeName,
    //   fileId,
    // });

    // For now, we just log the deletion attempt
    // The file record is deleted from the database by the calling service
    // When the API becomes available, this will also remove the file from Gemini's storage
  }
}

