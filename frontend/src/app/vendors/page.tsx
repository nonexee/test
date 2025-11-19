'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import apiClient from '@/lib/api';
import { ErrorMessages } from '@/lib/utils/errors';
import { apiCache, CacheKeys } from '@/lib/utils/cache';

interface Vendor {
  id: string;
  name: string;
  type: string;
  criticality: string;
  status: string;
  hasFacts: boolean;
  documentCount: number;
  createdAt: string;
}

export default function VendorsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [criticalityFilter, setCriticalityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sortBy, setSortBy] = useState<keyof Vendor>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Handle column sorting (LOW #42 fix)
  const handleSort = (column: keyof Vendor) => {
    if (sortBy === column) {
      // Toggle sort order if clicking same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to ascending for new column
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Sort vendors based on current sort settings
  const sortedVendors = [...vendors].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];

    // Handle different types
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue);
      return sortOrder === 'asc' ? comparison : -comparison;
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }

    if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
      return sortOrder === 'asc'
        ? (aValue === bValue ? 0 : aValue ? 1 : -1)
        : (aValue === bValue ? 0 : aValue ? -1 : 1);
    }

    return 0;
  });

  const fetchVendors = useCallback(async (skipCache = false) => {
    try {
      setLoading(true);

      // Generate cache key
      const cacheKey = CacheKeys.vendors.list({
        type: typeFilter,
        criticality: criticalityFilter,
        search: searchQuery,
      });

      // Try to get from cache first (unless skipCache is true)
      if (!skipCache) {
        const cachedData = apiCache.get<Vendor[]>(cacheKey);
        if (cachedData) {
          setVendors(cachedData);
          setLoading(false);
          return;
        }
      }

      // Fetch from API
      const params = new URLSearchParams();
      if (typeFilter) params.append('type', typeFilter);
      if (criticalityFilter) params.append('criticality', criticalityFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await apiClient.get(`/vendors?${params.toString()}`);
      setVendors(response.data);
      setError('');

      // Store in cache (5 minutes TTL)
      apiCache.set(cacheKey, response.data, 5 * 60 * 1000);
    } catch (err) {
      setError(ErrorMessages.vendor.list(err));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, criticalityFilter, searchQuery]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      fetchVendors();
    }
  }, [user, authLoading, fetchVendors, router]);

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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendors</h1>
            <p className="text-gray-600 mt-1">Manage your third-party vendors and suppliers</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/compliance/dora"
              prefetch={true}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              DORA Register
            </Link>
            {/* FIX GAP #12: Only show "Add Vendor" for ADMIN users */}
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                + Add Vendor
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="SAAS">SaaS</option>
              <option value="CLOUD_INFRA">Cloud Infrastructure</option>
              <option value="CONSULTING">Consulting</option>
              <option value="AI_SERVICE">AI Service</option>
              <option value="OTHER">Other</option>
            </select>
            <select
              value={criticalityFilter}
              onChange={(e) => setCriticalityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Criticality</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading vendors...</div>
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">No vendors found. Add your first vendor to get started!</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortBy === 'name' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('type')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      Type
                      {sortBy === 'type' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('criticality')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      Criticality
                      {sortBy === 'criticality' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortBy === 'status' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('documentCount')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      Documents
                      {sortBy === 'documentCount' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('hasFacts')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      Facts
                      {sortBy === 'hasFacts' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedVendors.map((vendor) => (
                  <tr
                    key={vendor.id}
                    onClick={() => router.push(`/vendors/${vendor.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{vendor.type.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          vendor.criticality === 'HIGH'
                            ? 'bg-red-100 text-red-800'
                            : vendor.criticality === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {vendor.criticality}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          vendor.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : vendor.status === 'IN_REVIEW'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {vendor.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {vendor.documentCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {vendor.hasFacts ? (
                        <span className="text-green-600">✓ Extracted</span>
                      ) : (
                        <span className="text-gray-400">Not extracted</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateVendorModal
          onClose={() => setShowCreateModal(false)}
          onOptimisticCreate={(vendor) => {
            // Add optimistic vendor to list immediately
            setVendors((prev) => [vendor, ...prev]);
            // Clear cache since we're adding a new vendor
            apiCache.clearPattern('vendors:list');
          }}
          onSuccess={(realVendor) => {
            // Replace optimistic vendor with real one
            setVendors((prev) =>
              prev.map((v) => (v.id.startsWith('temp-') ? realVendor : v))
            );
            // Clear cache to ensure fresh data on next fetch
            apiCache.clearPattern('vendors:list');
          }}
        />
      )}
    </div>
  );
}

function CreateVendorModal({
  onClose,
  onSuccess,
  onOptimisticCreate,
}: {
  onClose: () => void;
  onSuccess: (vendor: Vendor) => void;
  onOptimisticCreate: (vendor: Vendor) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('SAAS');
  const [criticality, setCriticality] = useState('MEDIUM');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Create optimistic vendor (temporary ID until real one arrives)
    const optimisticVendor: Vendor = {
      id: `temp-${Date.now()}`,
      name,
      type,
      criticality,
      status: 'DRAFT',
      hasFacts: false,
      documentCount: 0,
      createdAt: new Date().toISOString(),
    };

    // Add optimistically to the list
    onOptimisticCreate(optimisticVendor);
    onClose();

    try {
      const response = await apiClient.post('/vendors', { name, type, criticality });
      // Replace optimistic vendor with real one from API
      onSuccess(response.data);
    } catch (err) {
      setError(ErrorMessages.vendor.create(err));
      // On error, the parent will handle removing the optimistic vendor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Add New Vendor</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={255}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="SAAS">SaaS</option>
              <option value="CLOUD_INFRA">Cloud Infrastructure</option>
              <option value="CONSULTING">Consulting</option>
              <option value="AI_SERVICE">AI Service</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Criticality
            </label>
            <select
              value={criticality}
              onChange={(e) => setCriticality(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {loading ? 'Creating...' : 'Create Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
