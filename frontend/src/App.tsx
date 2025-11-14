import { NavLink, Routes, Route, Link } from 'react-router-dom';
import CalculatorPage from './pages/CalculatorPage';
import HealthCheckPage from './pages/HealthCheckPage';

const navClasses = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'
  }`;

const LandingPage = () => (
  <div className="px-4 py-6 sm:px-0">
    <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome to Pricing Calculator
        </h2>
        <p className="text-gray-600 mb-8">
          Calculate quotes, manage pricing, and generate professional documents.
        </p>
        <div className="space-y-2 text-sm text-gray-500 mb-6">
          <p>✓ Express app bootstrap setup</p>
          <p>✓ Observability instrumentation ready</p>
          <p>✓ Authentication middleware configured</p>
          <p>✓ React Query provider initialized</p>
          <p>• Global styles configuration (in progress)</p>
        </div>
        <Link
          to="/price-calculator"
          className="inline-flex items-center justify-center px-5 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow"
        >
          Open Calculator
        </Link>
      </div>
    </div>
  </div>
);

// Main App component - entry point for the pricing calculator application
function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Pricing Calculator
              </h1>
            </div>
            <nav className="flex space-x-4" aria-label="Primary">
              <NavLink to="/price-calculator" className={navClasses}>
                Calculator
              </NavLink>
              <button className="text-gray-400 cursor-not-allowed px-3 py-2 rounded-md text-sm font-medium" disabled>
                Quotes
              </button>
              <button className="text-gray-400 cursor-not-allowed px-3 py-2 rounded-md text-sm font-medium" disabled>
                Admin
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/price-calculator" element={<CalculatorPage />} />
          <Route path="/health" element={<HealthCheckPage />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;