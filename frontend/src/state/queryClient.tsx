// React Query configuration and query client setup
import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ApiError } from '../services/http';

// Create a client with custom configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Global query options
      retry: (failureCount, error) => {
        // Don't retry on authentication/authorization errors
        if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403)) {
          return false;
        }
        
        // Don't retry on client errors (4xx except 401/403)
        if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
          return false;
        }
        
        // Retry up to 3 times for server errors and network issues
        return failureCount < 3;
      },
      
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Stale time - how long data is considered fresh (5 minutes)
      staleTime: 5 * 60 * 1000,
      
      // Cache time - how long inactive data stays in cache (10 minutes)
      gcTime: 10 * 60 * 1000,
      
      // Refetch on window focus (disabled by default for better UX)
      refetchOnWindowFocus: false,
      
      // Refetch on reconnect
      refetchOnReconnect: 'always',
    },
    mutations: {
      // Global mutation options
      retry: (failureCount, error) => {
        // Never retry mutations with client errors
        if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
          return false;
        }
        
        // Retry up to 2 times for server errors
        return failureCount < 2;
      },
      
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

// Query client provider component
interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Only show devtools in development */}
      {import.meta.env.DEV && (
        <ReactQueryDevtools 
          initialIsOpen={false}
          position="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}

// Query keys factory for consistent key management
export const queryKeys = {
  // Health checks
  health: () => ['health'] as const,
  
  // Authentication
  auth: {
    all: () => ['auth'] as const,
    current: () => ['auth', 'current'] as const,
  },
  
  // Quotes
  quotes: {
    all: () => ['quotes'] as const,
    search: (params: Record<string, any>) => ['quotes', 'search', params] as const,
    byNumber: (quoteNumber: string) => ['quotes', 'byNumber', quoteNumber] as const,
    document: (quoteNumber: string) => ['quotes', 'document', quoteNumber] as const,
  },
  
  // Pricing configuration
  pricing: {
    all: () => ['pricing'] as const,
    current: () => ['pricing', 'current'] as const,
    byId: (id: string) => ['pricing', 'byId', id] as const,
    list: (params?: Record<string, any>) => ['pricing', 'list', params] as const,
  },
  
  // Calculator
  calculator: {
    calculate: (input: Record<string, any>) => ['calculator', 'calculate', input] as const,
  },
} as const;

// Utility function to invalidate related queries
export function invalidateQueries(patterns: string[][]) {
  patterns.forEach(pattern => {
    queryClient.invalidateQueries({ queryKey: pattern });
  });
}

// Common query options for different data types
export const queryOptions = {
  // Real-time data (shorter stale time)
  realTime: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  },
  
  // Static/configuration data (longer stale time)
  static: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  },
  
  // User-specific data (medium stale time)
  user: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  },
} as const;

// Error handling utilities
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

export function getErrorCode(error: unknown): string | undefined {
  if (isApiError(error)) {
    return error.code;
  }
  
  return undefined;
}

// Performance monitoring for queries
if (import.meta.env.DEV) {
  // Log slow queries in development
  queryClient.setQueryDefaults(['*'], {
    meta: {
      onSuccess: (data: any, query: any) => {
        const executionTime = Date.now() - query.state.dataUpdatedAt;
        if (executionTime > 2000) {
          console.warn(`Slow query detected: ${query.queryKey.join(' > ')} took ${executionTime}ms`);
        }
      },
    },
  });
}

export default queryClient;