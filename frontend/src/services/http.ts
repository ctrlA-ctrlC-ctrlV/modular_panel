// API client base for frontend requests
// Uses VITE_API_BASE environment variable for API endpoint configuration

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    statusCode: number;
    details?: Record<string, unknown>;
  };
}

export interface RequestConfig extends RequestInit {
  params?: Record<string, string>;
  timeout?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class HttpClient {
  private baseURL: string;
  private defaultHeaders: HeadersInit;
  private defaultTimeout: number;

  constructor(baseURL?: string) {
    // Use VITE_API_BASE env var or fallback to localhost
    this.baseURL = baseURL || import.meta.env.VITE_API_BASE || 'http://localhost:4000/api/v1';
    this.defaultTimeout = 10000; // 10 seconds
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };

    // Ensure baseURL doesn't end with slash
    this.baseURL = this.baseURL.replace(/\/$/, '');
  }

  private buildURL(endpoint: string, params?: Record<string, string>): string {
    // Ensure endpoint starts with /
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let url = `${this.baseURL}${cleanEndpoint}`;

    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value);
        }
      });
      
      const paramString = searchParams.toString();
      if (paramString) {
        url += `?${paramString}`;
      }
    }

    return url;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    let data: any;
    
    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      throw new ApiError(
        'Invalid JSON response from server',
        response.status,
        'INVALID_RESPONSE'
      );
    }

    if (!response.ok) {
      const errorData = data?.error || {};
      throw new ApiError(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData.code,
        errorData.details
      );
    }

    return {
      success: true,
      data: data
    };
  }

  private async request<T>(
    method: string,
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const { params, timeout = this.defaultTimeout, ...requestOptions } = config;
    
    const url = this.buildURL(endpoint, params);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...this.defaultHeaders,
          ...requestOptions.headers,
        },
        signal: controller.signal,
        ...requestOptions,
      });

      clearTimeout(timeoutId);
      return this.handleResponse<T>(response);
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError(
            `Request timeout after ${timeout}ms`,
            408,
            'REQUEST_TIMEOUT'
          );
        }
        
        throw new ApiError(
          error.message,
          0, // Network errors don't have status codes
          'NETWORK_ERROR'
        );
      }
      
      throw new ApiError(
        'Unknown error occurred',
        0,
        'UNKNOWN_ERROR'
      );
    }
  }

  // HTTP method helpers
  async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, config);
  }

  async post<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    const requestConfig: RequestConfig = { ...config };
    if (data) {
      requestConfig.body = JSON.stringify(data);
    }
    return this.request<T>('POST', endpoint, requestConfig);
  }

  async put<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    const requestConfig: RequestConfig = { ...config };
    if (data) {
      requestConfig.body = JSON.stringify(data);
    }
    return this.request<T>('PUT', endpoint, requestConfig);
  }

  async patch<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    const requestConfig: RequestConfig = { ...config };
    if (data) {
      requestConfig.body = JSON.stringify(data);
    }
    return this.request<T>('PATCH', endpoint, requestConfig);
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, config);
  }

  // Authentication methods
  setAuthToken(token: string): void {
    this.defaultHeaders = {
      ...this.defaultHeaders,
      Authorization: `Bearer ${token}`,
    };
  }

  setApiKey(apiKey: string): void {
    this.defaultHeaders = {
      ...this.defaultHeaders,
      Authorization: `ApiKey ${apiKey}`,
    };
  }

  clearAuth(): void {
    const headers = { ...this.defaultHeaders };
    delete (headers as any).Authorization;
    this.defaultHeaders = headers;
  }

  // Configuration methods
  setTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  setBaseURL(baseURL: string): void {
    this.baseURL = baseURL.replace(/\/$/, '');
  }

  getBaseURL(): string {
    return this.baseURL;
  }
}

// Default HTTP client instance
export const httpClient = new HttpClient();

// Helper function to create a new client with different config
export function createHttpClient(baseURL?: string): HttpClient {
  return new HttpClient(baseURL);
}

// Response type helpers for common API patterns
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version?: string;
  database?: {
    status: 'connected' | 'disconnected';
    latency?: number;
  };
}

// Common API endpoints (will be used by specific service modules)
export const API_ENDPOINTS = {
  // Health
  HEALTH: '/health',
  
  // Authentication
  AUTH: '/auth',
  
  // Calculator
  CALCULATE: '/calculate',
  
  // Quotes
  QUOTES: '/quotes',
  QUOTE_BY_NUMBER: (quoteNumber: string) => `/quotes/${quoteNumber}`,
  QUOTE_DOCUMENT: (quoteNumber: string) => `/quotes/${quoteNumber}/document`,
  
  // Pricing configuration
  PRICING: '/pricing',
  PRICING_CURRENT: '/pricing/current',
  PRICING_BY_ID: (id: string) => `/pricing/${id}`,
  PRICING_ACTIVATE: (id: string) => `/pricing/${id}/activate`,
} as const;