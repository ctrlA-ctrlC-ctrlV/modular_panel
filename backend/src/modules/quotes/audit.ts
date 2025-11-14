import { Quote } from '../../schemas/quote';
import logger from '../../instrumentation/logger';
import { quotesCreatedTotal } from '../../instrumentation/metrics';

/**
 * Audit logging helpers for quote lifecycle events.
 * Centralizes audit log shape to ensure consistency across emitters.
 */
export interface QuoteSaveAuditInput {
  quote: Quote;
  priceConfigId: string;
  performedBy?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Record an audit log entry for a saved quote (create or re-save event).
 */
export function recordQuoteSaved(input: QuoteSaveAuditInput): void {
  const { quote, priceConfigId, performedBy, ipAddress, userAgent, requestId } = input;

  const auditMeta: Record<string, unknown> = {
    resource: 'quote',
    resourceId: quote.quoteNumber,
    quoteNumber: quote.quoteNumber,
    quoteDate: quote.quoteDate,
    priceConfigId,
    currency: quote.currency,
    subtotalExVat: quote.estimate.subtotalExVat,
    totalIncVat: quote.estimate.totalIncVat,
    vatRate: quote.estimate.vatRate,
    lineItemCount: quote.estimate.lineItems.length,
    customerName: quote.customer.name
  };

  if (performedBy) {
    auditMeta.userId = performedBy;
  }

  if (ipAddress) {
    auditMeta.ip = ipAddress;
  }

  if (userAgent) {
    auditMeta.userAgent = userAgent;
  }

  if (requestId) {
    auditMeta.requestId = requestId;
  }

  if (quote.customer.email) {
    auditMeta.customerEmail = quote.customer.email;
  }

  if (quote.customer.phone) {
    auditMeta.customerPhone = quote.customer.phone;
  }

  logger.audit('quote.saved', auditMeta);
  quotesCreatedTotal.inc();
}
