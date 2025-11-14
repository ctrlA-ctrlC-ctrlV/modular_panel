// Main App component - entry point for the pricing calculator application

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Pricing Calculator
              </h1>
            </div>
            <nav className="flex space-x-4">
              <button className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium">
                Calculator
              </button>
              <button className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium">
                Quotes
              </button>
              <button className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium">
                Admin
              </button>
            </nav>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Welcome to Pricing Calculator
              </h2>
              <p className="text-gray-600 mb-8">
                Calculate quotes, manage pricing, and generate professional documents.
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <p>✓ Express app bootstrap setup</p>
                <p>✓ Observability instrumentation ready</p>
                <p>✓ Authentication middleware configured</p>
                <p>✓ React Query provider initialized</p>
                <p>• Global styles configuration (in progress)</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;