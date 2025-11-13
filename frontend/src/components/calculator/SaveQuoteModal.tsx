import React, { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  createQuoteWithValidation, 
  validateCustomerInfo,
  buildCreateQuoteRequest,
  formatCurrency,
  formatQuoteDate
} from '../../services/quotes';
import type { ProductConfigInput, CustomerInfo, Quote, QuoteEstimate } from '../../types/ProductConfig';

/**
 * Save Quote Modal Component
 * 
 * Modal dialog that:
 * 1. Collects customer information
 * 2. Validates input
 * 3. Creates a quote via API
 * 4. Displays success state with quote number
 * 5. Provides navigation options
 */

interface SaveQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  productConfig: ProductConfigInput;
  calculationResult: QuoteEstimate;
  onQuoteSaved?: (quote: Quote) => void;
}

interface CustomerFormState {
  name: string;
  email: string;
  phone: string;
  address: string;
}

const INITIAL_CUSTOMER_STATE: CustomerFormState = {
  name: '',
  email: '',
  phone: '',
  address: ''
};

export const SaveQuoteModal: React.FC<SaveQuoteModalProps> = ({
  isOpen,
  onClose,
  productConfig,
  calculationResult,
  onQuoteSaved
}) => {
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(INITIAL_CUSTOMER_STATE);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [savedQuote, setSavedQuote] = useState<Quote | null>(null);

  // Mutation for creating quote
  const createQuoteMutation = useMutation({
    mutationFn: createQuoteWithValidation,
    onSuccess: (response) => {
      if (response.data) {
        setSavedQuote(response.data);
        if (onQuoteSaved) {
          onQuoteSaved(response.data);
        }
      }
    },
    onError: (error: Error) => {
      console.error('Failed to create quote:', error);
      setValidationErrors([error.message || 'Failed to save quote. Please try again.']);
    }
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCustomerForm(INITIAL_CUSTOMER_STATE);
      setValidationErrors([]);
      setSavedQuote(null);
      createQuoteMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Update form field
  const updateField = useCallback((field: keyof CustomerFormState, value: string) => {
    setCustomerForm(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  }, [validationErrors.length]);

  // Validate and submit form
  const handleSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    
    // Build customer info from form
    const customerInfo: CustomerInfo = {
      name: customerForm.name.trim()
    };
    
    if (customerForm.email.trim()) {
      customerInfo.email = customerForm.email.trim();
    }
    
    if (customerForm.phone.trim()) {
      customerInfo.phone = customerForm.phone.trim();
    }
    
    if (customerForm.address.trim()) {
      customerInfo.address = customerForm.address.trim();
    }

    // Validate customer info
    const validation = validateCustomerInfo(customerInfo);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    // Build request and submit
    const request = buildCreateQuoteRequest(productConfig, customerInfo);
    setValidationErrors([]);
    createQuoteMutation.mutate(request);
  }, [customerForm, productConfig, createQuoteMutation]);

  // Handle modal close
  const handleClose = useCallback(() => {
    if (!createQuoteMutation.isPending) {
      onClose();
    }
  }, [createQuoteMutation.isPending, onClose]);

  // Handle starting new calculation
  const handleNewCalculation = useCallback(() => {
    onClose();
    // Parent component should handle resetting the calculation
  }, [onClose]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  // Success screen after quote is saved
  if (savedQuote) {
    return (
      <div 
        className="modal fade show d-block" 
        tabIndex={-1} 
        role="dialog"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={(e) => {
          // Only close if clicking the backdrop
          if (e.target === e.currentTarget) {
            handleClose();
          }
        }}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title">Quote Saved Successfully</h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={handleClose}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <div className="text-center py-4">
                <div className="mb-4">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="80" 
                    height="80" 
                    fill="currentColor" 
                    className="text-success" 
                    viewBox="0 0 16 16"
                  >
                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                  </svg>
                </div>
                <h4 className="mb-3">Your quote has been saved</h4>
                <div className="alert alert-success mb-4" role="alert">
                  <h5 className="alert-heading">Quote Number</h5>
                  <p className="mb-0 fs-3 fw-bold">{savedQuote.quoteNumber}</p>
                </div>
              </div>

              <div className="card mb-3">
                <div className="card-header">
                  <h6 className="mb-0">Quote Summary</h6>
                </div>
                <div className="card-body">
                  <div className="row mb-2">
                    <div className="col-6 text-muted">Quote Date:</div>
                    <div className="col-6 text-end">{formatQuoteDate(savedQuote.quoteDate)}</div>
                  </div>
                  <div className="row mb-2">
                    <div className="col-6 text-muted">Customer:</div>
                    <div className="col-6 text-end">{savedQuote.customer.name}</div>
                  </div>
                  {savedQuote.customer.email && (
                    <div className="row mb-2">
                      <div className="col-6 text-muted">Email:</div>
                      <div className="col-6 text-end">{savedQuote.customer.email}</div>
                    </div>
                  )}
                  {savedQuote.customer.phone && (
                    <div className="row mb-2">
                      <div className="col-6 text-muted">Phone:</div>
                      <div className="col-6 text-end">{savedQuote.customer.phone}</div>
                    </div>
                  )}
                  <hr />
                  <div className="row mb-2">
                    <div className="col-6 text-muted">Subtotal (Ex VAT):</div>
                    <div className="col-6 text-end fw-semibold">
                      {formatCurrency(savedQuote.estimate.subtotalExVat, savedQuote.currency)}
                    </div>
                  </div>
                  <div className="row mb-2">
                    <div className="col-6 text-muted">VAT ({savedQuote.estimate.vatRate}%):</div>
                    <div className="col-6 text-end fw-semibold">
                      {formatCurrency(
                        savedQuote.estimate.totalIncVat - savedQuote.estimate.subtotalExVat,
                        savedQuote.currency
                      )}
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-6 fw-bold">Total (Inc VAT):</div>
                    <div className="col-6 text-end fw-bold text-success fs-5">
                      {formatCurrency(savedQuote.estimate.totalIncVat, savedQuote.currency)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="alert alert-info" role="alert">
                <small>
                  <strong>Note:</strong> Please save or write down your quote number for future reference.
                  You can retrieve this quote later using the quote number.
                </small>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleNewCalculation}
              >
                New Calculation
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Customer information form
  return (
    <div 
      className="modal fade show d-block" 
      tabIndex={-1} 
      role="dialog"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget && !createQuoteMutation.isPending) {
          handleClose();
        }
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Save Quote</h5>
            <button
              type="button"
              className="btn-close"
              onClick={handleClose}
              disabled={createQuoteMutation.isPending}
              aria-label="Close"
            ></button>
          </div>
          <form onSubmit={handleSubmit} noValidate>
            <div className="modal-body">
              <p className="text-muted mb-4">
                Please provide customer information to save this quote. A unique quote number will be generated.
              </p>

              {/* Calculation Summary */}
              <div className="card mb-4 bg-light">
                <div className="card-body">
                  <h6 className="card-subtitle mb-3 text-muted">Quote Total</h6>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-semibold">Total (Inc VAT):</span>
                    <span className="fs-4 fw-bold text-primary">
                      {formatCurrency(calculationResult.totalIncVat, calculationResult.currency)}
                    </span>
                  </div>
                  <small className="text-muted">
                    Subtotal: {formatCurrency(calculationResult.subtotalExVat, calculationResult.currency)} + 
                    VAT ({calculationResult.vatRate}%): {formatCurrency(
                      calculationResult.totalIncVat - calculationResult.subtotalExVat,
                      calculationResult.currency
                    )}
                  </small>
                </div>
              </div>

              {/* Customer Form */}
              <div className="mb-3">
                <label htmlFor="customerName" className="form-label">
                  Customer Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className={`form-control ${validationErrors.length > 0 && !customerForm.name.trim() ? 'is-invalid' : ''}`}
                  id="customerName"
                  value={customerForm.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Enter customer name"
                  required
                  disabled={createQuoteMutation.isPending}
                  maxLength={200}
                  autoFocus
                />
              </div>

              <div className="mb-3">
                <label htmlFor="customerEmail" className="form-label">
                  Email Address (optional)
                </label>
                <input
                  type="email"
                  className={`form-control ${validationErrors.some(e => e.toLowerCase().includes('email')) ? 'is-invalid' : ''}`}
                  id="customerEmail"
                  value={customerForm.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="customer@example.com"
                  disabled={createQuoteMutation.isPending}
                  maxLength={320}
                />
              </div>

              <div className="mb-3">
                <label htmlFor="customerPhone" className="form-label">
                  Phone Number (optional)
                </label>
                <input
                  type="tel"
                  className={`form-control ${validationErrors.some(e => e.toLowerCase().includes('phone')) ? 'is-invalid' : ''}`}
                  id="customerPhone"
                  value={customerForm.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+44 1234 567890"
                  disabled={createQuoteMutation.isPending}
                  maxLength={20}
                />
                <small className="form-text text-muted">
                  Include country code if applicable
                </small>
              </div>

              <div className="mb-3">
                <label htmlFor="customerAddress" className="form-label">
                  Address (optional)
                </label>
                <textarea
                  className="form-control"
                  id="customerAddress"
                  value={customerForm.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Enter customer address"
                  rows={3}
                  disabled={createQuoteMutation.isPending}
                  maxLength={500}
                />
              </div>

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="alert alert-danger" role="alert">
                  <h6 className="alert-heading">Please correct the following errors:</h6>
                  <ul className="mb-0">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* API Error */}
              {createQuoteMutation.isError && !validationErrors.length && (
                <div className="alert alert-danger" role="alert">
                  <h6 className="alert-heading">Error</h6>
                  <p className="mb-0">
                    {createQuoteMutation.error?.message || 'Failed to save quote. Please try again.'}
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
                disabled={createQuoteMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createQuoteMutation.isPending || !customerForm.name.trim()}
              >
                {createQuoteMutation.isPending ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Saving...
                  </>
                ) : (
                  'Save Quote'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SaveQuoteModal;
