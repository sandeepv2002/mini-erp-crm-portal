# Mini ERP + CRM Operations Portal

> **Full-Stack Wholesale & Distribution Operations Management System**  
> Built using React (TypeScript), Node.js (Express REST API), PostgreSQL (Supabase), and Docker.

---

## 🌟 Overview & Architecture

Verve ERP + CRM is a role-based operations management platform built for wholesale and distribution businesses. It connects Sales, Warehouse, Accounts, and Management teams in a single unified interface to streamline customer relationships, inventory control, and sales delivery challans.

### System Architecture
```
┌─────────────────────────────────────────────────────────┐
│              React 18 + TypeScript Frontend             │
│  (Tailwind CSS, Vite, Lucide Icons, PDF Export Client)  │
└────────────────────────────┬────────────────────────────┘
                             │ REST API (JSON / JWT)
┌────────────────────────────▼────────────────────────────┐
│           Node.js + Express + TypeScript Backend        │
│  (Zod Validation, JWT Auth, Role Guard Middleware,      │
│   PDFKit Invoice Engine, Modular Controller Layer)      │
└────────────────────────────┬────────────────────────────┘
                             │ SQL / RPC Stored Procedures
┌────────────────────────────▼────────────────────────────┐
│                PostgreSQL Database (Supabase)           │
│  (Tables: profiles, customers, customer_notes,          │
│   products, stock_movements, sales_challans, items)   │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Test Credentials for All 4 Roles

You can test role-based access control using the 1-click **⚡ Demo Buttons** on the login screen or by using the credentials below:

| Role | Email | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| 🛡️ **Admin** | `admin@erpcrm.com` | `Password123!` | Full access to all modules, settings, and stock overrides |
| 🤝 **Sales** | `sales@erpcrm.com` | `Password123!` | Customer CRM, Follow-up Notes, Create & View Sales Challans |
| 📦 **Warehouse** | `warehouse@erpcrm.com` | `Password123!` | Products Catalog, Stock Movement Logs (IN/OUT), Dispatch |
| 💳 **Accounts** | `accounts@erpcrm.com` | `Password123!` | Customer Records, Sales Challans, Tax Invoice PDF Generation |

---

## 📦 Features Implemented

### 1. Authentication & Role-Based Access Control
- JWT-based REST API authentication with `Authorization: Bearer <token>` headers.
- Role-based middleware (`requireRole(['admin', 'warehouse'])`) enforcing backend and frontend permission boundaries.
- Pre-seeded test logins for Admin, Sales, Warehouse, and Accounts.

### 2. Customer CRM Module
- Customer management: Name, Mobile, Email, Business Name, GST Number, Type (Retail, Wholesale, Distributor), Address, Status (Lead, Active, Inactive), Follow-up Date, Notes.
- Search by customer name, phone, or business name + status & type filtering.
- **Dedicated Customer Detail Page** with interactive **Follow-up Notes Activity Log Timeline**.

### 3. Product & Inventory Module
- Catalog management: Product Name, SKU/Code, Category, Unit Price, Current Stock, Minimum Stock Alert, Location/Warehouse.
- Automatic **Low Stock Badging & Filtering** when stock reaches minimum threshold.
- Stock Movement Audit Log tracking Product, Quantity, IN/OUT type, Reason, Creator, and Timestamps.

### 4. Sales Challan & Invoicing Module
- Select customer, add multiple line items with auto-calculated subtotals and grand totals.
- Automatic challan number generation (`CHN-YYYY-XXXXXX`).
- Saves as **Draft** or **Confirmed**.
- **Atomic Stock Validation & Auto-Reduction**: Confirming a challan automatically verifies product stock levels, prevents negative inventory, reduces stock, and generates stock OUT movement logs.
- Stores product snapshot data (Name, SKU, Unit Price) so historical records remain untouched if catalog prices change.
- **Bonus Feature**: **Export Sales Challan / Tax Invoice as PDF** document.

### 5. DevOps & Containerization
- `server/Dockerfile`: Multi-stage Docker build for production Node/Express API.
- `Dockerfile`: Multi-stage Docker build with Nginx for React frontend.
- `docker-compose.yml`: Orchestrates PostgreSQL, Express Backend API, and Nginx Frontend.

---

## 🚀 How to Run Locally

### Option A: Standard Node.js Local Setup

1. **Install Dependencies**:
   ```bash
   # Install Frontend dependencies
   npm install

   # Install Backend dependencies
   cd server
   npm install
   cd ..
   ```

2. **Configure Environment Variables**:
   Ensure `.env` in root contains:
   ```env
   VITE_SUPABASE_URL=https://ocbovnvvdmxdejcswmca.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
   VITE_BACKEND_URL=http://localhost:5000/api
   ```
   Ensure `server/.env` contains:
   ```env
   PORT=5000
   JWT_SECRET=verve-erp-crm-super-secret-jwt-key-2026
   ```

3. **Start Development Servers**:
   ```bash
   # Terminal 1: Run Express REST API Backend (Port 5000)
   cd server
   npm run dev

   # Terminal 2: Run React Frontend (Port 5173)
   npm run dev
   ```

4. Open `http://localhost:5173` in your browser.

---

### Option B: Docker Compose Setup (Single Command)

To build and launch the database, REST backend, and web frontend in containers:

```bash
docker-compose up --build
```

- **Frontend**: http://localhost (Port 80)
- **Backend API**: http://localhost:5000/api
- **PostgreSQL**: localhost:5432

---

## 📄 Postman Collection & API Documentation

A complete Postman collection is included in [`postman_collection.json`](file:///c:/Users/Administrator/Downloads/project-bolt-sb1-blrzf6ju/project/postman_collection.json).

### Key Endpoints Overview

| Method | Endpoint | Description | Allowed Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user & get JWT token | Public |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Authenticated |
| `GET` | `/api/customers` | Search/Filter/Paginate customers | All Roles |
| `GET` | `/api/customers/:id` | View Customer Detail & Notes | All Roles |
| `POST` | `/api/customers` | Create new CRM customer | Admin, Sales, Accounts |
| `POST` | `/api/customers/:id/notes` | Add follow-up note to customer | Admin, Sales, Accounts |
| `GET` | `/api/products` | Search/Filter inventory catalog | All Roles |
| `POST` | `/api/products` | Create product in catalog | Admin, Warehouse |
| `POST` | `/api/stock-movements` | Manual stock movement (IN/OUT) | Admin, Warehouse |
| `GET` | `/api/challans` | List sales delivery challans | All Roles |
| `POST` | `/api/challans` | Create draft or confirmed challan | Admin, Sales, Accounts |
| `POST` | `/api/challans/:id/confirm` | Confirm challan & reduce stock | All Roles |
| `GET` | `/api/challans/:id/pdf` | Generate PDF Invoice stream | All Roles |

---

## 🌐 Deployment Instructions (Free Hosting)

### 1. Frontend Deployment (Vercel / Netlify / Render)
- Connect your GitHub repository to **Vercel** or **Render Static Site**.
- Set build command: `npm run build`
- Set output directory: `dist`
- Set Environment Variable: `VITE_BACKEND_URL=https://your-backend-api.onrender.com/api`

### 2. Backend Deployment (Render / Railway / Fly.io)
- Select the `server` directory as the root for your web service on **Render** or **Railway**.
- Build command: `npm run build`
- Start command: `node dist/index.js`
- Set Environment Variables: `PORT=5000`, `JWT_SECRET=your_jwt_secret`, `SUPABASE_URL=...`, `SUPABASE_SERVICE_ROLE_KEY=...`

### 3. Database (Supabase / Neon)
- Run `supabase/migrations/20260810122310_create_erp_operations_schema.sql` and `supabase/seed.sql` in your Supabase SQL Editor.

---

## 💡 Assumptions & Known Limitations

- **Stock Logic**: Stock reduction occurs when a challan transitions to `confirmed`. Cancelling a draft does not affect stock.
- **Snapshot Immutability**: Line items store product name and unit price at the time of creation to guarantee historical accuracy.
- **Offline Fallback**: The React app includes fallback handlers to continue functioning via Supabase SDK if the local Node backend is temporarily stopped.
