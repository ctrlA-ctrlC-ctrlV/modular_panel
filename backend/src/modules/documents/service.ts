import { chromium, Browser, Page } from 'playwright';
import { readFile } from 'fs/promises';
import { join } from 'path';
import logger from '../../instrumentation/logger';

/**
 * Document generation service for creating professional quote PDFs
 * Uses Playwright for HTML-to-PDF conversion with template rendering
 */

export interface QuoteDocumentData {
  // Meta information
  documentTitle: string;
  quoteNumber: string;
  quoteDate: string;
  generatedAt: string;
  
  // Brand information
  brandName: string;
  brandTagline: string;
  brandLogoUrl: string;
  
  // Customer information
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  
  // Company information
  companyContactBlock: string;
  
  // Project details
  projectSummary: string;
  specificationRows: string; // HTML table rows
  
  // Financial details
  lineItemRows: string; // HTML table rows
  subtotalExVat: string;
  vatRate: string;
  vatAmount: string;
  totalIncVat: string;
  currencyCode: string;
  
  // Additional information
  notes: string;
  termsAndConditions: string;
}

export interface DocumentGenerationOptions {
  format?: 'A4' | 'Letter';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  displayHeaderFooter?: boolean;
  printBackground?: boolean;
}

export class DocumentGenerationError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'DocumentGenerationError';
  }
}

export class DocumentService {
  private browser: Browser | null = null;
  private templatePath: string;

  constructor() {
    this.templatePath = join(__dirname, 'templates', 'quote.html');
  }

  /**
   * Initialize the browser instance
   */
  private async initializeBrowser(): Promise<Browser> {
    if (!this.browser) {
      logger.info('Initializing Playwright browser for document generation');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
    }
    return this.browser;
  }

  /**
   * Load and render the HTML template with data
   */
  private async renderTemplate(data: QuoteDocumentData): Promise<string> {
    try {
      const templateContent = await readFile(this.templatePath, 'utf-8');
      
      // Simple template variable replacement
      let renderedHtml = templateContent;
      
      // Replace all template variables with actual data
      const replacements: Record<string, string> = {
        documentTitle: data.documentTitle,
        quoteNumber: data.quoteNumber,
        quoteDate: data.quoteDate,
        generatedAt: data.generatedAt,
        brandName: data.brandName,
        brandTagline: data.brandTagline,
        brandLogoUrl: data.brandLogoUrl,
        customerName: data.customerName,
        customerEmail: data.customerEmail || 'N/A',
        customerPhone: data.customerPhone || 'N/A',
        customerAddress: data.customerAddress || 'N/A',
        companyContactBlock: data.companyContactBlock,
        projectSummary: data.projectSummary,
        specificationRows: data.specificationRows,
        lineItemRows: data.lineItemRows,
        subtotalExVat: data.subtotalExVat,
        vatRate: data.vatRate,
        vatAmount: data.vatAmount,
        totalIncVat: data.totalIncVat,
        currencyCode: data.currencyCode,
        notes: data.notes,
        termsAndConditions: data.termsAndConditions
      };

      // Replace template variables ({{variableName}})
      for (const [key, value] of Object.entries(replacements)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        renderedHtml = renderedHtml.replace(regex, value);
      }

      return renderedHtml;
    } catch (error) {
      logger.error('Failed to render HTML template', { 
        templatePath: this.templatePath,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new DocumentGenerationError('Failed to render HTML template', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Generate PDF document from quote data
   */
  async generatePDF(
    data: QuoteDocumentData, 
    options: DocumentGenerationOptions = {}
  ): Promise<Buffer> {
    const startTime = Date.now();
    let page: Page | null = null;

    try {
      logger.info('Starting PDF generation', { 
        quoteNumber: data.quoteNumber,
        format: options.format || 'A4'
      });

      // Initialize browser and create page
      const browser = await this.initializeBrowser();
      page = await browser.newPage();

      // Render HTML template
      const renderedHtml = await this.renderTemplate(data);

      // Set content and wait for load
      await page.setContent(renderedHtml, { 
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Generate PDF with options
      const pdfOptions = {
        format: (options.format || 'A4') as 'A4' | 'Letter',
        margin: {
          top: '32px',
          right: '32px',
          bottom: '32px',
          left: '32px',
          ...options.margin
        },
        displayHeaderFooter: options.displayHeaderFooter || false,
        printBackground: options.printBackground !== false, // Default to true
        preferCSSPageSize: true
      };

      const pdfBuffer = await page.pdf(pdfOptions);

      const duration = Date.now() - startTime;
      logger.info('PDF generation completed', { 
        quoteNumber: data.quoteNumber,
        duration,
        sizeBytes: pdfBuffer.length
      });

      return pdfBuffer;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('PDF generation failed', { 
        quoteNumber: data.quoteNumber,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw new DocumentGenerationError(
        `Failed to generate PDF for quote ${data.quoteNumber}`,
        error instanceof Error ? error : undefined
      );
    } finally {
      // Clean up page
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          logger.warn('Failed to close page', { 
            error: closeError instanceof Error ? closeError.message : String(closeError)
          });
        }
      }
    }
  }

  /**
   * Close browser instance and clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        logger.info('Document service browser closed');
      } catch (error) {
        logger.error('Failed to close browser', { 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Format currency amount for display
   */
  static formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Format date for display
   */
  static formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  }

  /**
   * Format date and time for display
   */
  static formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }

  /**
   * Generate specification rows HTML from product configuration
   */
  static generateSpecificationRows(productConfig: Record<string, unknown>): string {
    const rows: string[] = [];

    // Extract key specifications from product config
    if (productConfig.size && typeof productConfig.size === 'object') {
      const size = productConfig.size as { widthM?: number; depthM?: number };
      if (size.widthM && size.depthM) {
        rows.push(`<tr><td>Dimensions</td><td>${size.widthM}m × ${size.depthM}m</td></tr>`);
        rows.push(`<tr><td>Floor Area</td><td>${(size.widthM * size.depthM).toFixed(1)} m²</td></tr>`);
      }
    }

    if (productConfig.cladding && typeof productConfig.cladding === 'object') {
      const cladding = productConfig.cladding as { areaSqm?: number };
      if (cladding.areaSqm) {
        rows.push(`<tr><td>Cladding Area</td><td>${cladding.areaSqm} m²</td></tr>`);
      }
    }

    if (productConfig.bathroom && typeof productConfig.bathroom === 'object') {
      const bathroom = productConfig.bathroom as { half?: number; three_quarter?: number };
      if (bathroom.half) {
        rows.push(`<tr><td>Half Bathrooms</td><td>${bathroom.half}</td></tr>`);
      }
      if (bathroom.three_quarter) {
        rows.push(`<tr><td>Three-Quarter Bathrooms</td><td>${bathroom.three_quarter}</td></tr>`);
      }
    }

    if (productConfig.electrical && typeof productConfig.electrical === 'object') {
      const electrical = productConfig.electrical as { switches?: number; sockets?: number; heater?: number };
      if (electrical.switches) {
        rows.push(`<tr><td>Light Switches</td><td>${electrical.switches}</td></tr>`);
      }
      if (electrical.sockets) {
        rows.push(`<tr><td>Power Sockets</td><td>${electrical.sockets}</td></tr>`);
      }
      if (electrical.heater) {
        rows.push(`<tr><td>Electric Heaters</td><td>${electrical.heater}</td></tr>`);
      }
    }

    if (productConfig.floor && typeof productConfig.floor === 'object') {
      const floor = productConfig.floor as { type?: string; areaSqM?: number };
      if (floor.type && floor.type !== 'none') {
        rows.push(`<tr><td>Flooring</td><td>${floor.type.charAt(0).toUpperCase() + floor.type.slice(1)} (${floor.areaSqM || 'N/A'} m²)</td></tr>`);
      }
    }

    return rows.join('\n');
  }

  /**
   * Generate line item rows HTML from line items
   */
  static generateLineItemRows(lineItems: Array<{
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>, currency: string): string {
    return lineItems.map(item => {
      const unitPriceFormatted = DocumentService.formatCurrency(item.unitPrice, currency);
      const lineTotalFormatted = DocumentService.formatCurrency(item.lineTotal, currency);
      
      return `<tr>
        <td>${item.code}</td>
        <td>${item.description}</td>
        <td>${item.quantity}</td>
        <td class="amount">${unitPriceFormatted}</td>
        <td class="amount">${lineTotalFormatted}</td>
      </tr>`;
    }).join('\n');
  }
}

// Singleton instance for reuse
let documentService: DocumentService | null = null;

/**
 * Get singleton document service instance
 */
export function getDocumentService(): DocumentService {
  if (!documentService) {
    documentService = new DocumentService();
  }
  return documentService;
}

/**
 * Clean up document service resources
 */
export async function cleanupDocumentService(): Promise<void> {
  if (documentService) {
    await documentService.cleanup();
    documentService = null;
  }
}