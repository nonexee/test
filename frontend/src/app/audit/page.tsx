'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import apiClient from '@/lib/api';
import type { AuditLog } from '@/types';

/**
 * Audit Logs Page
 * Fixes GAP #14: Audit logs UI missing
 */
export default function AuditLogsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);

  // Statistics
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchLogs();
      fetchStatistics();
    }
  }, [user, actionFilter, resourceFilter, startDate, endDate, page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (actionFilter) params.append('action', actionFilter);
      if (resourceFilter) params.append('resource', resourceFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('limit', limit.toString());
      params.append('offset', ((page - 1) * limit).toString());

      const response = await apiClient.get(`/audit/logs?${params.toString()}`);
      setLogs(response.data.logs || response.data);
      setTotal(response.data.total || response.data.length);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await apiClient.get('/audit/statistics');
      setStats(response.data);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionBadgeColor = (action: string) => {
    if (action.startsWith('DELETE') || action.includes('REVOKE')) {
      return 'bg-red-100 text-red-800';
    }
    if (action.startsWith('CREATE') || action.startsWith('REGISTER')) {
      return 'bg-green-100 text-green-800';
    }
    if (action.startsWith('UPDATE') || action.startsWith('PATCH')) {
      return 'bg-blue-100 text-blue-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-1">View all system activity and user actions</p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Total Actions</div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalActions || 0}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Today</div>
              <div className="text-2xl font-bold text-gray-900">{stats.actionsToday || 0}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">This Week</div>
              <div className="text-2xl font-bold text-gray-900">{stats.actionsThisWeek || 0}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">This Month</div>
              <div className="text-2xl font-bold text-gray-900">{stats.actionsThisMonth || 0}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <h2 className="font-semibold mb-3">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Actions</option>
                <option value="CREATE_VENDOR">Create Vendor</option>
                <option value="UPDATE_VENDOR">Update Vendor</option>
                <option value="DELETE_VENDOR">Delete Vendor</option>
                <option value="UPLOAD_DOCUMENT">Upload Document</option>
                <option value="DELETE_DOCUMENT">Delete Document</option>
                <option value="TRIGGER_EXTRACTION">Trigger Extraction</option>
                <option value="REGISTER_TENANT">Register Tenant</option>
                <option value="LOGIN">Login</option>
                <option value="LOGOUT">Logout</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resource</label>
              <select
                value={resourceFilter}
                onChange={(e) => {
                  setResourceFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Resources</option>
                <option value="VENDOR">Vendor</option>
                <option value="DOCUMENT">Document</option>
                <option value="EXTRACTION_JOB">Extraction Job</option>
                <option value="USER">User</option>
                <option value="TENANT">Tenant</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {(actionFilter || resourceFilter || startDate || endDate) && (
            <button
              onClick={() => {
                setActionFilter('');
                setResourceFilter('');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800"
            >
              Clear Filters
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
        )}

        {/* Audit Logs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-600">Loading audit logs...</div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No audit logs found.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Resource
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {log.user?.email || 'System'}
                          </div>
                          {log.user?.role && (
                            <div className="text-xs text-gray-500">{log.user.role}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.resource}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {log.metadata && (
                            <div className="max-w-xs truncate" title={JSON.stringify(log.metadata)}>
                              {JSON.stringify(log.metadata)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}{' '}
                    results
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">
                        Page {page} of {totalPages}
                      </span>
                    </div>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
    </div>
  );
}
