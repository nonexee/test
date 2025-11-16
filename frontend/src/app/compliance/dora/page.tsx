'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import apiClient from '@/lib/api';

interface DoraVendor {
  id: string;
  name: string;
  type: string;
  criticality: string;
  status: string;
  hasFacts: boolean;
  facts?: {
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
  };
}

export default function DoraRegisterPage() {
  const router = useRouter();
  const { user, tenant, loading: authLoading } = useAuth();
  const [vendors, setVendors] = useState<DoraVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      fetchDoraVendors();
    }
  }, [user, authLoading]);

  const fetchDoraVendors = async () => {
    try {
      setLoading(true);
      // Fetch all vendors with full facts
      const response = await apiClient.get('/vendors?includeFacts=true');
      const allVendors = response.data;

      // Filter to only DORA-relevant vendors with facts
      const doraVendors = allVendors
        .filter((v: DoraVendor) => v.facts?.regulatoryRelevance?.dora === true)
        .sort((a: DoraVendor, b: DoraVendor) => {
          // Sort by criticality: HIGH > MEDIUM > LOW
          const criticalityOrder: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          return (criticalityOrder[b.criticality] || 0) - (criticalityOrder[a.criticality] || 0);
        });

      setVendors(doraVendors);
      setError('');
    } catch (err) {
      setError('Failed to fetch DORA vendors');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    // Generate CSV content
    const headers = [
      'Vendor Name',
      'Type',
      'Criticality',
      'Status',
      'Business Functions',
      'Services Supported',
      'Data Categories',
      'Regions',
      'Sub-processors',
      'Security Highlights',
      'Impact if Compromised',
      'DORA Relevant',
      'NIS2 Relevant',
      'AI Act Relevant',
      'Last Extracted',
    ];

    const rows = vendors.map((vendor) => [
      vendor.name,
      vendor.type.replace(/_/g, ' '),
      vendor.criticality,
      vendor.status,
      vendor.facts?.businessFunctions ?? '',
      vendor.facts?.servicesSupported ?? '',
      (vendor.facts?.dataCategories ?? []).join('; '),
      (vendor.facts?.regions ?? []).join('; '),
      (vendor.facts?.subProcessors ?? []).map((sp) => `${sp.name} (${sp.region})`).join('; '),
      vendor.facts?.securityHighlights ?? '',
      vendor.facts?.impactIfCompromised ?? '',
      vendor.facts?.regulatoryRelevance?.dora ? 'Yes' : 'No',
      vendor.facts?.regulatoryRelevance?.nis2 ? 'Yes' : 'No',
      vendor.facts?.regulatoryRelevance?.ai_act ? 'Yes' : 'No',
      vendor.facts?.lastExtractionAt ? new Date(vendor.facts.lastExtractionAt).toLocaleDateString() : '',
    ]);

    // Escape CSV values and prevent formula injection (XSS mitigation)
    const escapeCSV = (value: string) => {
      // Prevent formula injection by prepending apostrophe to values starting with =, +, -, @
      if (value.match(/^[=+\-@]/)) {
        value = "'" + value;
      }
      // Escape quotes and wrap in quotes if contains special chars
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) => row.map(escapeCSV).join(',')),
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `dora-register-${tenant?.name || 'export'}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/vendors" className="text-blue-600 hover:underline text-sm">
            ← Back to Vendors
          </Link>
        </div>

        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">DORA Compliance Register</h1>
            <p className="text-gray-600 mt-2">
              ICT third-party service providers relevant for Digital Operational Resilience Act (DORA)
            </p>
            {tenant && (
              <p className="text-sm text-gray-500 mt-1">Organization: {tenant.name}</p>
            )}
          </div>
          <button
            onClick={exportToCSV}
            disabled={vendors.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export to CSV
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading DORA register...</div>
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 mb-4">
              No DORA-relevant vendors found with extracted facts.
            </p>
            <p className="text-sm text-gray-500">
              Upload documents for your ICT vendors and run extraction to populate this register.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-blue-900">DORA Register Summary</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Total DORA-relevant ICT service providers: <strong>{vendors.length}</strong>
                  </p>
                  <p className="text-sm text-blue-700">
                    High criticality: <strong>{vendors.filter(v => v.criticality === 'HIGH').length}</strong>
                  </p>
                </div>
              </div>
            </div>

            {vendors.map((vendor) => (
              <div key={vendor.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{vendor.name}</h3>
                      <div className="flex gap-2 mt-2">
                        <span className="text-sm text-gray-600">
                          {vendor.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span
                          className={`text-sm font-semibold ${
                            vendor.criticality === 'HIGH'
                              ? 'text-red-600'
                              : vendor.criticality === 'MEDIUM'
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          }`}
                        >
                          {vendor.criticality} Criticality
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/vendors/${vendor.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Business Functions</h4>
                      <p className="text-sm text-gray-900">{vendor.facts?.businessFunctions ?? 'Not specified'}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Services Supported</h4>
                      <p className="text-sm text-gray-900">{vendor.facts?.servicesSupported ?? 'Not specified'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Data Categories</h4>
                      <div className="flex flex-wrap gap-1">
                        {(vendor.facts?.dataCategories ?? []).map((category, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Regions</h4>
                      <div className="flex flex-wrap gap-1">
                        {(vendor.facts?.regions ?? []).map((region, idx) => (
                          <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                            {region}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {(vendor.facts?.subProcessors ?? []).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Sub-processors</h4>
                      <div className="bg-gray-50 rounded p-3">
                        <div className="space-y-1">
                          {(vendor.facts?.subProcessors ?? []).map((sp, idx) => (
                            <div key={idx} className="text-sm text-gray-900">
                              <strong>{sp.name}</strong> ({sp.region}) - {sp.role}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Security Highlights</h4>
                    <p className="text-sm text-gray-900">{vendor.facts?.securityHighlights ?? 'Not specified'}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Impact if Compromised</h4>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${
                          vendor.facts?.impactIfCompromised === 'HIGH'
                            ? 'bg-red-100 text-red-800'
                            : vendor.facts?.impactIfCompromised === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {vendor.facts?.impactIfCompromised ?? 'Not specified'}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Regulatory Relevance</h4>
                      <div className="flex gap-2">
                        {vendor.facts?.regulatoryRelevance?.dora && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-semibold">
                            DORA
                          </span>
                        )}
                        {vendor.facts?.regulatoryRelevance?.nis2 && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-semibold">
                            NIS2
                          </span>
                        )}
                        {vendor.facts?.regulatoryRelevance?.ai_act && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded font-semibold">
                            AI Act
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Last Extracted</h4>
                      <p className="text-sm text-gray-600">
                        {vendor.facts?.lastExtractionAt ? new Date(vendor.facts.lastExtractionAt).toLocaleDateString() : 'Not extracted'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
