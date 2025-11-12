import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { httpClient, HealthCheckResponse } from '../services/http';
import { queryKeys } from '../state/queryClient';

// Health check status interface
interface HealthStatus {
  overall: 'healthy' | 'unhealthy' | 'loading';
  details?: HealthCheckResponse;
  error?: string;
}

/**
 * Health Check Page Component
 * Displays system health status and database connectivity
 * Useful for operations teams and monitoring
 */
export default function HealthCheckPage() {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10000); // 10 seconds

  // Query for health check data
  const {
    data: healthData,
    error,
    isLoading,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: queryKeys.health(),
    queryFn: async (): Promise<HealthCheckResponse> => {
      const response = await httpClient.get<HealthCheckResponse>('/health');
      if (!response.success || !response.data) {
        throw new Error('Health check failed');
      }
      return response.data;
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    retry: 1, // Only retry once for health checks
    staleTime: 5000, // Consider data stale after 5 seconds
  });

  // Determine overall health status
  const healthStatus: HealthStatus = React.useMemo(() => {
    if (isLoading) {
      return { overall: 'loading' };
    }
    
    if (error) {
      return { 
        overall: 'unhealthy', 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
    
    if (healthData) {
      return {
        overall: healthData.status === 'healthy' ? 'healthy' : 'unhealthy',
        details: healthData,
      };
    }
    
    return { overall: 'loading' };
  }, [isLoading, error, healthData]);

  // Format uptime in human readable format
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0) parts.push(`${secs}s`);
    
    return parts.join(' ') || '0s';
  };

  // Format memory usage
  const formatMemory = (bytes: number): string => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  // Status indicator component
  const StatusIndicator: React.FC<{ status: string; label: string }> = ({ status, label }) => {
    const getStatusColor = (status: string) => {
      switch (status.toLowerCase()) {
        case 'healthy':
        case 'connected':
        case 'pass':
        case 'ready':
        case 'alive':
          return 'text-green-600 bg-green-100';
        case 'unhealthy':
        case 'disconnected':
        case 'fail':
        case 'not-ready':
          return 'text-red-600 bg-red-100';
        case 'loading':
          return 'text-yellow-600 bg-yellow-100';
        default:
          return 'text-gray-600 bg-gray-100';
      }
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Health Check</h1>
          <p className="mt-2 text-gray-600">
            Monitor application and database health status
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="btn-primary-custom"
          >
            {isLoading ? 'Checking...' : 'Refresh Now'}
          </button>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="autoRefresh" className="text-sm text-gray-700">
              Auto-refresh
            </label>
          </div>
          
          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded-md px-3 py-1"
            >
              <option value={5000}>5 seconds</option>
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
              <option value={60000}>1 minute</option>
            </select>
          )}
          
          {dataUpdatedAt && (
            <span className="text-sm text-gray-500">
              Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Overall Status Card */}
        <div className="card-custom mb-6">
          <div className="card-header-custom">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
              Overall Status
              <StatusIndicator 
                status={healthStatus.overall} 
                label={healthStatus.overall.toUpperCase()} 
              />
            </h2>
          </div>
          <div className="card-body-custom">
            {healthStatus.error && (
              <div className="alert-danger-custom">
                <strong>Error:</strong> {healthStatus.error}
              </div>
            )}
            
            {healthStatus.details && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">Version</div>
                  <div className="text-lg text-gray-900">{healthStatus.details.version}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Environment</div>
                  <div className="text-lg text-gray-900">{healthStatus.details.environment}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Uptime</div>
                  <div className="text-lg text-gray-900">{formatUptime(healthStatus.details.uptime)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Database Status */}
        {healthStatus.details?.database && (
          <div className="card-custom mb-6">
            <div className="card-header-custom">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
                Database Status
                <StatusIndicator 
                  status={healthStatus.details.database.status} 
                  label={healthStatus.details.database.status.toUpperCase()} 
                />
              </h2>
            </div>
            <div className="card-body-custom">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">Connection Latency</div>
                  <div className="text-lg text-gray-900">
                    {healthStatus.details.database.latency ? 
                      `${healthStatus.details.database.latency}ms` : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Pool Connections</div>
                  <div className="text-lg text-gray-900">
                    {healthStatus.details.database.pool.totalConnections} total, {' '}
                    {healthStatus.details.database.pool.idleConnections} idle
                  </div>
                </div>
              </div>
              
              {healthStatus.details.database.error && (
                <div className="mt-4 alert-danger-custom">
                  <strong>Database Error:</strong> {healthStatus.details.database.error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Memory Usage */}
        {healthStatus.details?.memory && (
          <div className="card-custom mb-6">
            <div className="card-header-custom">
              <h2 className="text-lg font-semibold text-gray-900">Memory Usage</h2>
            </div>
            <div className="card-body-custom">
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Memory Usage</span>
                  <span>{healthStatus.details.memory.percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      healthStatus.details.memory.percentage > 80 ? 'bg-red-500' :
                      healthStatus.details.memory.percentage > 60 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${healthStatus.details.memory.percentage}%` }}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Used</div>
                  <div className="font-medium">{formatMemory(healthStatus.details.memory.used)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Free</div>
                  <div className="font-medium">{formatMemory(healthStatus.details.memory.free)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Total</div>
                  <div className="font-medium">{formatMemory(healthStatus.details.memory.total)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* JSON Response (for debugging) */}
        {healthStatus.details && (
          <div className="card-custom">
            <div className="card-header-custom">
              <h2 className="text-lg font-semibold text-gray-900">Raw Response</h2>
            </div>
            <div className="card-body-custom">
              <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-x-auto">
                {JSON.stringify(healthStatus.details, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}