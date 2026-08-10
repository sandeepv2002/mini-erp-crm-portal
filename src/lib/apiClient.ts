import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('verve_jwt_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('verve_jwt_token', token);
  } else {
    localStorage.removeItem('verve_jwt_token');
  }
}

export async function restFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<{ success: boolean; data?: T; error?: string; pagination?: any }> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const body = await res.json();
    if (!res.ok) {
      return { success: false, error: body.error || body.message || `HTTP error ${res.status}` };
    }
    return body;
  } catch (err: any) {
    console.warn(`REST API failed at ${endpoint}, fallback to local SDK:`, err.message);
    return { success: false, error: err.message };
  }
}

export async function downloadChallanPDF(challanId: string, challanNumber: string) {
  const token = getAuthToken();
  try {
    const res = await fetch(`${API_BASE_URL}/challans/${challanId}/pdf`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    if (!res.ok) {
      throw new Error('Could not download PDF from server');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${challanNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err: any) {
    alert(`PDF Export Note: Backend server at http://localhost:5000 is required for PDF generation. (${err.message})`);
  }
}
