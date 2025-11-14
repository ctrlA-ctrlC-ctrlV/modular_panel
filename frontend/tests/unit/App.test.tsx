import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../../src/App';

const renderWithProviders = (initialEntries: string[] = ['/']) => {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('App navigation', () => {
  it('links the Calculator button to /price-calculator', () => {
    renderWithProviders();
    const calculatorLink = screen.getByRole('link', { name: /^calculator$/i });
    expect(calculatorLink).toHaveAttribute('href', '/price-calculator');
  });
});
