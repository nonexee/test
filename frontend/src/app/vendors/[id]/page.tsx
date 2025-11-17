'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { useAuth } from '@/lib/auth';
import apiClient from '@/lib/api';
import { formatDate } from '@/lib/utils/date';
import { ErrorMessages } from '@/lib/utils/errors';
import { apiCache, CacheKeys } from '@/lib/utils/cache';

interface VendorDetail {
  id: string;
  name: string;
  type: string;
  criticality: string;
  status: string;
  documents: Array<{
    id: string;
    fileName: string;
    fileType: string;
    uploadedAt: string;
  }>;
  facts: {
    dataCategories?: string[];
    regions?: string[];
    subProcessors?: Array<{ name: string; region: string; role: string }>;
    servicesSupported?: string;
    businessFunctions?: string;
    securityHighlights?: string;
    impactIfCompromised?: string;
    regulatoryRelevance?: {
      dora?: boolean;
      nis2?: boolean;
      ai_act?: boolean;
    };
    lastExtractionAt?: string;
  } | null;
  extractionJobs: Array<{
    id: string;
    status: string;
    createdAt: string;
    finishedAt: string | null;
  }>;
  extractionJobsMetadata?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface SourceResult {
  statement: string;
  sources: Array<{
    documentId: string;
    fileName: string;
    chunk: string;
    relevanceScore: number;
  }>;
}

export default function VendorDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState('CONTRACT');
  const [showSourcesFor, setShowSourcesFor] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceResult | null>(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const [jobsPage, setJobsPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      fetchVendorDetail();
    }
  }, [user, authLoading, params.id]);

  // Poll for extraction progress
  useEffect(() => {
    if (!extracting || !vendor) return;

    const interval = setInterval(async () => {
      await fetchVendorDetail();
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [extracting, vendor]);

  // Check extraction job status and stop polling when complete
  useEffect(() => {
    if (!extracting || !vendor) return;

    // Check if there's a running extraction job
    const latestJob = vendor.extractionJobs?.[0]; // Assuming jobs are sorted by createdAt desc
    if (latestJob) {
      // Stop polling if job is completed or errored
      if (latestJob.status === 'SUCCESS' || latestJob.status === 'ERROR') {
        setExtracting(false);
      }
    }
  }, [vendor, extracting]);

  const fetchVendorDetail = async (page?: number, skipCache = false) => {
    try {
      setLoading(true);
      const currentPage = page ?? jobsPage;

      // Generate cache key
      const cacheKey = CacheKeys.vendors.detail(params.id, currentPage);

      // Try to get from cache first (unless skipCache is true)
      if (!skipCache) {
        const cachedData = apiCache.get<VendorDetail>(cacheKey);
        if (cachedData) {
          setVendor(cachedData);
          setLoading(false);
          return;
        }
      }

      // Fetch from API
      const response = await apiClient.get(`/vendors/${params.id}?jobsPage=${currentPage}&jobsLimit=10`);
      setVendor(response.data);
      setError('');

      // Store in cache (3 minutes TTL for detail page since it updates more frequently)
      apiCache.set(cacheKey, response.data, 3 * 60 * 1000);
    } catch (err) {
      setError(ErrorMessages.vendor.fetch(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // File size validation (10MB max)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Please select a file smaller than 10MB.`);
        return;
      }

      const allowedTypes = [
        'application/pdf',
        'application/msword', // .doc files
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];

      if (!allowedTypes.includes(file.type)) {
        setUploadError(`Unsupported file type (${file.type}). Please upload PDF, DOC, DOCX, TXT, CSV, XLS, or XLSX files.`);
        return;
      }

      setSelectedFile(file);
      setUploadError('');
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploadingFile(true);
      setUploadError('');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('fileType', fileType);

      await apiClient.post(`/vendors/${params.id}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSelectedFile(null);
      // Reset file input (SSR-safe)
      if (typeof window !== 'undefined') {
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }

      // Refresh vendor data (skip cache to get fresh data)
      apiCache.delete(CacheKeys.vendors.detail(params.id, jobsPage));
      await fetchVendorDetail(undefined, true);
    } catch (err) {
      setUploadError(ErrorMessages.document.upload(err));
    } finally {
      setUploadingFile(false);
    }
  };

  const handleTriggerExtraction = async () => {
    try {
      setExtracting(true);
      setExtractError('');

      await apiClient.post(`/vendors/${params.id}/extract`);

      // Refresh vendor data to show new extraction job (skip cache)
      // Don't set extracting to false - let polling handle it
      apiCache.delete(CacheKeys.vendors.detail(params.id, jobsPage));
      await fetchVendorDetail(undefined, true);
    } catch (err) {
      setExtractError(ErrorMessages.extraction.trigger(err));
      setExtracting(false); // Only set to false on error
    }
  };

  const handleShowSources = async (statement: string) => {
    if (showSourcesFor === statement) {
      setShowSourcesFor(null);
      setSources(null);
      return;
    }

    try {
      setLoadingSources(true);
      setShowSourcesFor(statement);

      const response = await apiClient.get(`/vendors/${params.id}/sources`, {
        params: { statement },
      });

      setSources(response.data);
    } catch (err) {
      console.error('Failed to fetch sources:', err);
      setSources(null);
    } finally {
      setLoadingSources(false);
    }
  };

  const handleDeleteVendor = async () => {
    try {
      setDeleting(true);
      await apiClient.delete(`/vendors/${params.id}`);
      // Redirect to vendors list after successful deletion
      router.push('/vendors');
    } catch (err) {
      setError(ErrorMessages.vendor.delete(err));
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const getCriticalityColor = (criticality: string) => {
    switch (criticality) {
      case 'HIGH':
        return 'bg-red-100 text-red-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOW':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'IN_REVIEW':
        return 'bg-yellow-100 text-yellow-800';
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'bg-green-100 text-green-800';
      case 'ERROR':
        return 'bg-red-100 text-red-800';
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading vendor details...</div>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-100 text-red-700 p-4 rounded-lg">
            {error || 'Vendor not found'}
          </div>
          <Link
            href="/vendors"
            prefetch={true}
            className="mt-4 inline-block text-blue-600 hover:text-blue-800"
          >
            Back to Vendors
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/vendors"
            prefetch={true}
            className="text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            &larr; Back to Vendors
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{vendor.name}</h1>
              <p className="text-gray-600 mt-1">Vendor Details and Documentation</p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Delete Vendor
            </button>
          </div>
        </div>

        {/* Vendor Information Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Vendor Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">Type</div>
              <div className="font-medium">{vendor.type.replace(/_/g, ' ')}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Criticality</div>
              <span
                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getCriticalityColor(
                  vendor.criticality
                )}`}
              >
                {vendor.criticality}
              </span>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Status</div>
              <span
                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                  vendor.status
                )}`}
              >
                {vendor.status}
              </span>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Documents</div>
              <div className="font-medium">{vendor.documents.length}</div>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Documents</h2>

          {/* Upload Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-3">Upload New Document</h3>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
              <div className="md:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Type
                </label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CONTRACT">Contract</option>
                  <option value="DPA">Data Processing Agreement</option>
                  <option value="SOC2">SOC 2 Report</option>
                  <option value="SECURITY_WHITEPAPER">Security Whitepaper</option>
                  <option value="AI_DOC">AI Documentation</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="md:col-span-8">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select File
                </label>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <input
                      id="file-upload"
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
                      onChange={handleFileSelect}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Accepted formats: PDF, DOC, DOCX, TXT, CSV, XLS, XLSX (max 10MB)
                    </p>
                  </div>
                  <button
                    onClick={handleFileUpload}
                    disabled={!selectedFile || uploadingFile}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {uploadingFile ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
            {uploadError && (
              <div className="mt-2 text-sm text-red-600">{uploadError}</div>
            )}
          </div>

          {/* Documents List */}
          {vendor.documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No documents uploaded yet. Upload a document to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uploaded At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vendor.documents.map((doc) => (
                    <tr key={doc.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{doc.fileName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{doc.fileType}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{formatDate(doc.uploadedAt)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Extracted Facts Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Extracted Facts</h2>
            <button
              onClick={handleTriggerExtraction}
              disabled={extracting || vendor.documents.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {extracting ? 'Triggering...' : 'Trigger Extraction'}
            </button>
          </div>

          {extractError && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
              {extractError}
            </div>
          )}

          {/* Extraction progress indicator */}
          {extracting && vendor.extractionJobs.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div>
                  <div className="font-semibold text-blue-900">Extraction in progress...</div>
                  <div className="text-sm text-blue-700">
                    Status: {vendor.extractionJobs[0].status}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    This may take a few minutes. Page will update automatically.
                  </div>
                </div>
              </div>
            </div>
          )}

          {vendor.documents.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Upload documents first to extract facts.
            </div>
          )}

          {vendor.documents.length > 0 && !vendor.facts && !extracting && (
            <div className="text-center py-8 text-gray-500">
              No facts extracted yet. Click "Trigger Extraction" to analyze documents.
            </div>
          )}

          {vendor.facts && (
            <div className="space-y-6">
              {/* Last Extracted */}
              <div className="text-sm text-gray-500 mb-4">
                Last extracted: {vendor.facts.lastExtractionAt ? formatDate(vendor.facts.lastExtractionAt) : 'Not extracted yet'}
              </div>

              {/* Data Categories */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900">Data Categories</div>
                  <button
                    onClick={() => handleShowSources('data_categories')}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {showSourcesFor === 'data_categories' ? 'Hide Sources' : 'Show Sources'}
                  </button>
                </div>
                {(vendor.facts.dataCategories ?? []).length === 0 ? (
                  <div className="text-sm text-gray-500 italic">No data categories identified in documents</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(vendor.facts.dataCategories ?? []).map((category, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                )}
                {showSourcesFor === 'data_categories' && (
                  <SourcesDisplay sources={sources} loading={loadingSources} />
                )}
              </div>

              {/* Regions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900">Regions</div>
                  <button
                    onClick={() => handleShowSources('regions')}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {showSourcesFor === 'regions' ? 'Hide Sources' : 'Show Sources'}
                  </button>
                </div>
                {(vendor.facts.regions ?? []).length === 0 ? (
                  <div className="text-sm text-gray-500 italic">No regions identified in documents</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(vendor.facts.regions ?? []).map((region, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                      >
                        {region}
                      </span>
                    ))}
                  </div>
                )}
                {showSourcesFor === 'regions' && (
                  <SourcesDisplay sources={sources} loading={loadingSources} />
                )}
              </div>

              {/* Sub-processors */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900">Sub-processors</div>
                  <button
                    onClick={() => handleShowSources('subProcessors')}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {showSourcesFor === 'subProcessors' ? 'Hide Sources' : 'Show Sources'}
                  </button>
                </div>
                {(vendor.facts.subProcessors ?? []).length === 0 ? (
                  <div className="text-sm text-gray-500">None identified</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                            Name
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                            Region
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                            Role
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(vendor.facts.subProcessors ?? []).map((sp, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm text-gray-900">{sp.name}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{sp.region}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{sp.role}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {showSourcesFor === 'subProcessors' && (
                  <SourcesDisplay sources={sources} loading={loadingSources} />
                )}
              </div>

              {/* Services Supported */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900">Services Supported</div>
                  <button
                    onClick={() => handleShowSources('servicesSupported')}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {showSourcesFor === 'servicesSupported' ? 'Hide Sources' : 'Show Sources'}
                  </button>
                </div>
                <div className="text-sm text-gray-700">{vendor.facts.servicesSupported ?? 'Not specified'}</div>
                {showSourcesFor === 'servicesSupported' && (
                  <SourcesDisplay sources={sources} loading={loadingSources} />
                )}
              </div>

              {/* Business Functions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900">Business Functions</div>
                  <button
                    onClick={() => handleShowSources('businessFunctions')}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {showSourcesFor === 'businessFunctions' ? 'Hide Sources' : 'Show Sources'}
                  </button>
                </div>
                <div className="text-sm text-gray-700">{vendor.facts.businessFunctions ?? 'Not specified'}</div>
                {showSourcesFor === 'businessFunctions' && (
                  <SourcesDisplay sources={sources} loading={loadingSources} />
                )}
              </div>

              {/* Security Highlights */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900">Security Highlights</div>
                  <button
                    onClick={() => handleShowSources('securityHighlights')}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {showSourcesFor === 'securityHighlights' ? 'Hide Sources' : 'Show Sources'}
                  </button>
                </div>
                <div className="text-sm text-gray-700">{vendor.facts.securityHighlights ?? 'Not specified'}</div>
                {showSourcesFor === 'securityHighlights' && (
                  <SourcesDisplay sources={sources} loading={loadingSources} />
                )}
              </div>

              {/* Impact if Compromised */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900">Impact if Compromised</div>
                  <button
                    onClick={() => handleShowSources('impactIfCompromised')}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {showSourcesFor === 'impactIfCompromised' ? 'Hide Sources' : 'Show Sources'}
                  </button>
                </div>
                <div className="text-sm text-gray-700">{vendor.facts.impactIfCompromised ?? 'Not specified'}</div>
                {showSourcesFor === 'impactIfCompromised' && (
                  <SourcesDisplay sources={sources} loading={loadingSources} />
                )}
              </div>

              {/* Regulatory Relevance */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900">Regulatory Relevance</div>
                  <button
                    onClick={() => handleShowSources('regulatoryRelevance')}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {showSourcesFor === 'regulatoryRelevance' ? 'Hide Sources' : 'Show Sources'}
                  </button>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">DORA:</span>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        vendor.facts.regulatoryRelevance?.dora
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {vendor.facts.regulatoryRelevance?.dora ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">NIS2:</span>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        vendor.facts.regulatoryRelevance?.nis2
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {vendor.facts.regulatoryRelevance?.nis2 ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">AI Act:</span>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        vendor.facts.regulatoryRelevance?.ai_act
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {vendor.facts.regulatoryRelevance?.ai_act ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                {showSourcesFor === 'regulatoryRelevance' && (
                  <SourcesDisplay sources={sources} loading={loadingSources} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Extraction Jobs History */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Extraction Jobs History</h2>
          {vendor.extractionJobsMetadata && vendor.extractionJobsMetadata.total > 0 && (
            <div className="mb-4 text-sm text-gray-600">
              Showing {vendor.extractionJobs.length} of {vendor.extractionJobsMetadata.total} jobs
            </div>
          )}
          {vendor.extractionJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No extraction jobs yet.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Job ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Completed At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {vendor.extractionJobs.map((job) => (
                      <tr key={job.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono text-gray-900">{job.id.slice(0, 8)}...</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getJobStatusColor(
                              job.status
                            )}`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{formatDate(job.createdAt)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {job.finishedAt ? formatDate(job.finishedAt) : '-'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              {vendor.extractionJobsMetadata && vendor.extractionJobsMetadata.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {vendor.extractionJobsMetadata.page} of {vendor.extractionJobsMetadata.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const newPage = jobsPage - 1;
                        setJobsPage(newPage);
                        fetchVendorDetail(newPage);
                      }}
                      disabled={jobsPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => {
                        const newPage = jobsPage + 1;
                        setJobsPage(newPage);
                        fetchVendorDetail(newPage);
                      }}
                      disabled={jobsPage === vendor.extractionJobsMetadata.totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Delete Vendor</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete <strong>{vendor.name}</strong>?
            </p>
            <p className="mb-6 text-sm text-gray-600">
              This action cannot be undone. All documents, extracted facts, and extraction jobs associated with this vendor will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVendor}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {deleting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SourcesDisplay({
  sources,
  loading,
}: {
  sources: SourceResult | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-600">Loading sources...</div>
      </div>
    );
  }

  if (!sources || sources.sources.length === 0) {
    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-600">No sources found</div>
      </div>
    );
  }

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-3">
      {sources.sources.map((source, idx) => (
        <div key={idx} className="p-3 bg-white rounded border border-gray-200">
          <div className="flex justify-between items-start mb-2">
            <div className="text-xs font-medium text-gray-900">{source.fileName}</div>
            <div className="text-xs text-gray-500">
              Score: {(source.relevanceScore * 100).toFixed(1)}%
            </div>
          </div>
          <div className="text-sm text-gray-700 italic">"{source.chunk}"</div>
        </div>
      ))}
    </div>
  );
}
