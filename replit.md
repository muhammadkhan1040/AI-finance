# CheckMy.ai - Mortgage Rate Comparison Application

## Overview

CheckMy.ai is an AI-powered mortgage rate comparison platform designed for Arizona homebuyers and homeowners. The application provides a multi-step lead capture form that collects user information (loan purpose, property details, personal info) and returns calculated mortgage rates from multiple lenders. The system features a "Galaxy" themed UI with glassmorphism effects and complex animations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state, React hooks for local state
- **Styling**: Tailwind CSS with custom "Galaxy" cosmic theme featuring CSS variables for theming
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Animations**: Framer Motion for complex step transitions and floating elements
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Design**: RESTful endpoints defined in shared routes configuration
- **Request Handling**: JSON body parsing with raw body capture for potential webhook support

### Data Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with Zod schema validation (drizzle-zod)
- **Schema Location**: `shared/schema.ts` contains table definitions and validation schemas
- **Migrations**: Managed via `drizzle-kit push` command

### Shared Code Pattern
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts`: Database table definitions, TypeScript types, and Zod validation schemas
- `routes.ts`: API route definitions with input/output schemas for type-safe API calls

### Key Design Decisions

1. **Monorepo Structure**: Client (`client/`), server (`server/`), and shared (`shared/`) code colocated for easier development and type sharing.

2. **Type-Safe API Layer**: Route definitions in `shared/routes.ts` include Zod schemas for request/response validation, enabling end-to-end type safety.

3. **Mock Rate Generation**: Currently generates mock mortgage rates based on credit score ranges. The rate calculation logic lives in `server/routes.ts`.

4. **Multi-Step Form Flow**: The lead form progresses through three steps (Goals → Property → Details) with per-step validation before submission.

5. **Production Build**: Uses esbuild for server bundling with specific dependencies allowlisted for bundling to optimize cold start times.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **connect-pg-simple**: PostgreSQL session store (available but not currently implemented)

### Frontend Libraries
- **@tanstack/react-query**: Async state management and caching
- **framer-motion**: Animation library for step transitions
- **react-hook-form**: Form state management with Zod resolver
- **Radix UI**: Accessible component primitives (accordion, dialog, select, tabs, etc.)

### Backend Libraries
- **drizzle-orm**: TypeScript ORM for PostgreSQL
- **zod**: Schema validation for API inputs
- **express**: HTTP server framework

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development
- **drizzle-kit**: Database migration tooling