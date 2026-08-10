import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRouter from './routes/auth';
import customerRouter from './routes/customers';
import productRouter from './routes/products';
import stockMovementRouter from './routes/stockMovements';
import challanRouter from './routes/challans';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'Verve ERP & CRM Backend REST API',
    message: 'Welcome to the Verve ERP + CRM Backend API',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/login',
      customers: '/api/customers',
      products: '/api/products',
      stockMovements: '/api/stock-movements',
      challans: '/api/challans',
    },
    version: '1.0.0',
  });
});

// API Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Verve ERP & CRM Backend REST API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Route Mounting
app.use('/api/auth', authRouter);
app.use('/api/customers', customerRouter);
app.use('/api/products', productRouter);
app.use('/api/stock-movements', stockMovementRouter);
app.use('/api/challans', challanRouter);

// 404 Route Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Verve ERP & CRM Backend REST API running on http://localhost:${PORT}`);
});
