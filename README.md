# Mini ERP + CRM Operations Portal

This is a complete, production-ready Full-Stack Monorepo consisting of a Node.js/Express backend (`/server`) and a React/Ant Design frontend (`/client`).

## Architecture Overview

- **Frontend (`/client`)**: Built with React, Vite, TypeScript, and Ant Design (`antd`). Uses React Router for navigation and Context API for global state management (Authentication).
- **Backend (`/server`)**: Built with Node.js, Express, and TypeScript. Exposes a robust REST API.
- **Database**: PostgreSQL (connected via the raw `pg` driver for maximum performance and SQL control).
- **Authentication**: JWT-based stateless authentication with Role-Based Access Control (RBAC) and bcrypt password hashing.

## Features Included

- **Role-Based Access Control**: Four distinct roles (`Admin`, `Sales`, `Warehouse`, `Accounts`), each with unique dashboard views and sidebar navigation options.
- **CRM Module**: Manage customers with tags (Lead/Active/Inactive), categorization (Retail/Wholesale/Distributor), and detailed follow-up notes.
- **Inventory Module**: Track products, warehouse locations, set minimum stock alerts (highlighted in red when low), and log all stock movements (IN/OUT).
- **Sales Challans**: Complex business logic.
  - Generate challans in `Draft` state (acts as a hold).
  - Change to `Confirmed` state to instantly deduct inventory stock.
  - Strict validation: Prevents confirmation if insufficient stock.
  - Line-items capture a JSON snapshot of the product name and price to preserve historical data regardless of future product updates.
  - One-click PDF Invoice generation via `pdfkit`.

## Prerequisites

- Node.js (v18+)
- PostgreSQL (v14+) running locally or remotely.

## Setup Instructions

### 1. Database Setup
Execute the provided SQL scripts into your PostgreSQL database:
1. `database/schema.sql` (Creates tables, relations, and indexes)
2. `database/seed.sql` (Inserts mock data for testing)

### 2. Backend Setup
1. Navigate to the `server` directory: `cd server`
2. Install dependencies: `npm install`
3. Create a `.env` file (copy from `.env.example`):
   ```env
   PORT=5000
   JWT_SECRET=verve-erp-crm-super-secret-jwt-key-2026
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/verve_erp
   ```
4. Start the development server: `npm run dev`

### 3. Frontend Setup
1. Navigate to the `client` directory: `cd client`
2. Install dependencies: `npm install`
3. Start the Vite dev server: `npm run dev`
4. The application will be available at `http://localhost:5173`.

## Test Login Credentials

The application includes 1-click Demo Account login buttons on the sign-in screen, or you can manually use:

| Role      | Email                  | Password    |
|-----------|------------------------|-------------|
| Admin     | admin@verveerp.com     | password123 |
| Sales     | sales@verveerp.com     | password123 |
| Warehouse | warehouse@verveerp.com | password123 |
| Accounts  | accounts@verveerp.com  | password123 |

## Project Structure

```
├── client/                 # Frontend React Application
│   ├── public/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── context/        # Auth Context
│   │   ├── pages/          # Main Views (Login, Dashboard, CRM, Inventory, Challans)
│   │   ├── App.tsx         # Layout & Routing
│   │   └── main.tsx        # Entry point
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Backend Express Application
│   ├── src/
│   │   ├── middleware/     # Auth & Role guards
│   │   ├── routes/         # API Controllers (auth, customers, products, challans, stockMovements, pdf)
│   │   ├── db.ts           # PostgreSQL pg client pool
│   │   └── index.ts        # Express App configuration
│   ├── package.json
│   └── tsconfig.json
└── database/
    ├── schema.sql          # DDL Schema
    └── seed.sql            # DML Seed Data
```

## Future Enhancements
- Dockerization for single-command deployment.
- E2E testing using Playwright or Cypress.
