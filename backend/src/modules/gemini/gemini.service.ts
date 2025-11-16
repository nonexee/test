import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

  constructor(private configService: ConfigService) {
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
   * TODO: Implement actual Gemini File Search store creation when API is available
   */
  async createFileSearchStore(tenantId: string): Promise<string> {
    this.logger.log(`Creating File Search store for tenant: ${tenantId}`);

    // TODO: Replace with actual Gemini File Search API call
    // For now, return a unique store identifier
    const storeName = `tenant_${tenantId}_store_${Date.now()}`;

    this.logger.log(`Created File Search store: ${storeName}`);
    return storeName;
  }

  /**
   * Upload a file to the tenant's File Search store
   * TODO: Implement actual file upload to Gemini File Search
   */
  async uploadFileToStore(
    storeName: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<string> {
    this.logger.log(`Uploading file ${fileName} to store ${storeName}`);

    // TODO: Replace with actual Gemini File Search upload
    // For now, return a mock file identifier
    const fileId = `file_${Date.now()}_${fileName}`;

    this.logger.log(`File uploaded with ID: ${fileId}`);
    return fileId;
  }

  /**
   * Run vendor facts extraction using Gemini with File Search
   */
  async runVendorExtraction(
    storeName: string,
    vendorName: string,
  ): Promise<VendorFactsExtraction> {
    this.logger.log(`Running extraction for vendor: ${vendorName} using store: ${storeName}`);

    if (!this.genAI) {
      this.logger.warn('Gemini not configured, returning mock data');
      return this.getMockExtraction(vendorName);
    }

    try {
      // TODO: Implement actual File Search integration when API is available
      // For now, use basic generative model
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = this.buildExtractionPrompt(vendorName);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Try to parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.validateAndNormalizeExtraction(parsed);
      }

      this.logger.warn('Failed to parse JSON from Gemini response, using mock data');
      return this.getMockExtraction(vendorName);
    } catch (error) {
      this.logger.error(`Extraction error: ${error.message}`, error.stack);
      return this.getMockExtraction(vendorName);
    }
  }

  /**
   * Get supporting snippets for a given statement
   * TODO: Implement actual File Search query
   */
  async getSupportingSnippets(
    storeName: string,
    statement: string,
  ): Promise<SupportingSnippet[]> {
    this.logger.log(`Getting snippets for statement in store ${storeName}`);

    // TODO: Replace with actual File Search query
    // For now, return mock snippets
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
}
