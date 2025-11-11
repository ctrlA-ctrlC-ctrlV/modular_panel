# Modular Panel - Pricing Calculator

A React-based pricing calculator for garden room construction with dynamic quote computation, real-time tax application, quote persistence, and professional document generation.

## Project Structure

```
modular_panel/
├── backend/              # Express.js API server
│   ├── src/
│   │   ├── api/         # Routes, controllers, middleware
│   │   ├── config/      # Environment configuration
│   │   ├── db/          # Database migrations and queries
│   │   ├── modules/     # Business logic modules
│   │   ├── schemas/     # Zod validation schemas
│   │   └── instrumentation/  # Logging and observability
│   └── tests/           # Backend tests
├── frontend/            # React.js client app
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── services/    # API clients
│   │   ├── state/       # State management
│   │   └── styles/      # CSS and styling
│   └── tests/          # Frontend tests
└── specs/              # Project specifications
    └── 001-pricing-calculator/
```

## Tech Stack

### Backend
- **Runtime**: Node.js 22 LTS + TypeScript 5.x
- **Framework**: Express 4.19.x
- **Database**: PostgreSQL 17 (DigitalOcean managed)
- **Validation**: Zod
- **Logging**: Winston
- **Testing**: Jest + Supertest

### Frontend
- **Framework**: React 18.2
- **Styling**: Tailwind CSS 3.4.x + Bootstrap 5.3.x
- **Build Tool**: Vite
- **State Management**: React Query
- **Testing**: Vitest + React Testing Library

## Phase 1 Setup - COMPLETED ✅

All Phase 1 tasks have been successfully completed:

- ✅ T001: Project structure created
- ✅ T002: Node.js + TypeScript backend initialized
- ✅ T003: React frontend app initialized
- ✅ T004: Tailwind + Bootstrap styling configured
- ✅ T005: TypeScript configurations set up
- ✅ T006: ESLint + Prettier configs added
- ✅ T007: Backend folder skeleton created
- ✅ T008: Frontend folder skeleton created

## Next Steps

Phase 2 (Foundational) tasks are ready to begin:
- Database migration tooling
- Configuration loader and logging
- Express app bootstrap with middleware
- API client setup
- React Query provider setup

## Development Setup

### Prerequisites
- Node.js 22.x LTS
- PostgreSQL 17
- npm or pnpm

### Installation

1. **Backend Setup**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your database credentials
   npm install
   npm run dev
   ```

2. **Frontend Setup**:
   ```bash
   cd frontend
   cp .env.example .env
   # Edit .env with your API base URL
   npm install
   npm run dev
   ```

### Available Scripts

#### Backend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run lint` - Lint code

#### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests with Vitest
- `npm run lint` - Lint code

## Architecture Principles

The implementation follows these key principles:

1. **Modular Architecture** - Separate modules with explicit API contracts
2. **Versioned Interfaces** - `/api/v1/` namespace for API versioning  
3. **Test-First Development** - Contract tests before implementation
4. **Observability** - Structured logging, metrics, and tracing
5. **Performance & Security** - Defined budgets and validation

For detailed implementation plan, see `specs/001-pricing-calculator/`.