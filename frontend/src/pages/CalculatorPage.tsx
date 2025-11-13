import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalculatorForm } from '../components/calculator/CalculatorForm';
import { SaveQuoteModal } from '../components/calculator/SaveQuoteModal';
import { calculatePricing } from '../services/calculate';
import { formatCurrency } from '../services/quotes';
import type { ProductConfigInput, QuoteEstimate, Quote } from '../types/ProductConfig';

/**
 * Calculator Page Component
 * 
 * Main page for the pricing calculator application.
 * Manages the calculation workflow:
 * 1. User fills out the CalculatorForm
 * 2. Form is submitted and calculation is performed
 * 3. Results are displayed with line items and totals
 * 4. User can save the quote with customer information (T046)
 */

export const CalculatorPage: React.FC = () => {
  const [calculationResult, setCalculationResult] = useState<QuoteEstimate | null>(null);
  const [productConfig, setProductConfig] = useState<ProductConfigInput | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedQuote, setSavedQuote] = useState<Quote | null>(null);

  // Mutation for calculating pricing
  const calculateMutation = useMutation({
    mutationFn: calculatePricing,
    onSuccess: (response) => {
      if (response.data) {
        setCalculationResult(response.data);
      }
    },
    onError: (error: Error) => {
      console.error('Calculation failed:', error);
      setCalculationResult(null);
    }
  });

  // Handle calculation request from form
  const handleCalculate = (config: ProductConfigInput) => {
    setProductConfig(config);
    setCalculationResult(null);
    calculateMutation.mutate(config);
  };

  // Reset to start a new calculation
  const handleReset = () => {
    setCalculationResult(null);
    setProductConfig(null);
    setSavedQuote(null);
    calculateMutation.reset();
  };

  // Handle opening the save quote modal
  const handleOpenSaveModal = () => {
    setShowSaveModal(true);
  };

  // Handle closing the save quote modal
  const handleCloseSaveModal = () => {
    setShowSaveModal(false);
  };

  // Handle when a quote is successfully saved
  const handleQuoteSaved = (quote: Quote) => {
    setSavedQuote(quote);
    // Modal will automatically show success screen
  };

  return (
    <div className="calculator-page">
      <div className="container-fluid py-4">
        {/* Success notification after saving quote */}
        {savedQuote && (
          <div className="row mb-3">
            <div className="col-12">
              <div className="alert alert-success alert-dismissible fade show" role="alert">
                <h5 className="alert-heading">Quote Saved Successfully!</h5>
                <p className="mb-0">
                  Your quote has been saved with number: <strong className="font-monospace">{savedQuote.quoteNumber}</strong>
                </p>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSavedQuote(null)}
                  aria-label="Close"
                ></button>
              </div>
            </div>
          </div>
        )}

        <div className="row">
          {/* Calculator Form Section */}
          <div className={calculationResult ? 'col-lg-7' : 'col-12'}>
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-primary text-white">
                <h3 className="card-title mb-0">Price Calculator</h3>
                <p className="mb-0 mt-2 small">
                  Enter your product specifications to calculate pricing
                </p>
              </div>
              <div className="card-body">
                <CalculatorForm
                  onCalculate={handleCalculate}
                  isLoading={calculateMutation.isPending}
                  errors={
                    calculateMutation.isError
                      ? { general: calculateMutation.error?.message || 'Calculation failed' }
                      : {}
                  }
                  {...(productConfig ? { defaultValues: productConfig } : {})}
                />
              </div>
            </div>
          </div>

          {/* Results Section */}
          {calculationResult && (
            <div className="col-lg-5">
              <div className="card shadow-sm mb-4 sticky-top" style={{ top: '1rem' }}>
                <div className="card-header bg-success text-white">
                  <div className="d-flex justify-content-between align-items-center">
                    <h4 className="card-title mb-0">Calculation Results</h4>
                    <button
                      type="button"
                      className="btn btn-sm btn-light"
                      onClick={handleReset}
                      title="Start new calculation"
                    >
                      New Calculation
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  {/* Summary Totals */}
                  <div className="mb-4 p-3 bg-light rounded">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-semibold text-muted">Subtotal (Ex VAT):</span>
                      <span className="fs-5 fw-semibold">
                        {formatCurrency(calculationResult.subtotalExVat, calculationResult.currency)}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-semibold text-muted">
                        VAT ({calculationResult.vatRate}%):
                      </span>
                      <span className="fs-5 fw-semibold">
                        {formatCurrency(
                          calculationResult.totalIncVat - calculationResult.subtotalExVat,
                          calculationResult.currency
                        )}
                      </span>
                    </div>
                    <hr className="my-2" />
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="fw-bold fs-5">Total (Inc VAT):</span>
                      <span className="fs-4 fw-bold text-success">
                        {formatCurrency(calculationResult.totalIncVat, calculationResult.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Line Items Breakdown */}
                  {calculationResult.lineItems && calculationResult.lineItems.length > 0 && (
                    <div>
                      <h5 className="mb-3">Breakdown</h5>
                      <div className="table-responsive">
                        <table className="table table-sm table-hover">
                          <thead className="table-light">
                            <tr>
                              <th>Item</th>
                              <th className="text-end">Qty</th>
                              <th className="text-end">Unit</th>
                              <th className="text-end">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calculationResult.lineItems.map((item, index) => (
                              <tr key={`${item.code}-${index}`}>
                                <td>
                                  <div className="fw-semibold">{item.description}</div>
                                  <small className="text-muted">{item.code}</small>
                                </td>
                                <td className="text-end">{item.quantity}</td>
                                <td className="text-end">
                                  {formatCurrency(item.unitPrice, calculationResult.currency)}
                                </td>
                                <td className="text-end fw-semibold">
                                  {formatCurrency(item.lineTotal, calculationResult.currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-4 d-grid gap-2">
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      onClick={handleOpenSaveModal}
                      disabled={!calculationResult}
                    >
                      Save Quote
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => window.print()}
                    >
                      Print Estimate
                    </button>
                  </div>

                  {/* Notes Section */}
                  {productConfig?.notes && (
                    <div className="mt-4 p-3 bg-light rounded">
                      <h6 className="fw-semibold mb-2">Notes:</h6>
                      <p className="mb-0 small text-muted">{productConfig.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {calculateMutation.isError && (
          <div className="row mt-4">
            <div className="col-12">
              <div className="alert alert-danger alert-dismissible fade show" role="alert">
                <h5 className="alert-heading">Calculation Error</h5>
                <p className="mb-0">
                  {calculateMutation.error?.message || 
                   'An error occurred while calculating the price. Please check your input and try again.'}
                </p>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => calculateMutation.reset()}
                  aria-label="Close"
                ></button>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {calculateMutation.isPending && (
          <div 
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-50"
            style={{ zIndex: 1050 }}
          >
            <div className="card shadow-lg">
              <div className="card-body text-center p-4">
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Calculating...</span>
                </div>
                <h5 className="card-title">Calculating Price</h5>
                <p className="card-text text-muted">
                  Please wait while we compute your quote...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Save Quote Modal */}
        {calculationResult && productConfig && (
          <SaveQuoteModal
            isOpen={showSaveModal}
            onClose={handleCloseSaveModal}
            productConfig={productConfig}
            calculationResult={calculationResult}
            onQuoteSaved={handleQuoteSaved}
          />
        )}
      </div>
    </div>
  );
};

export default CalculatorPage;
