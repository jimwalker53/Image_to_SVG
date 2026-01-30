import type { VectorizationSettings, ConversionResponse } from '../types';

const API_BASE = '/api';

export async function convertImage(
  file: File,
  settings: VectorizationSettings
): Promise<ConversionResponse> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('settings', JSON.stringify(settings));

  const response = await fetch(`${API_BASE}/convert`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Conversion failed' }));
    throw new Error(error.error || 'Conversion failed');
  }

  return response.json();
}

export async function convertBase64Image(
  base64: string,
  settings: VectorizationSettings,
  filename?: string
): Promise<ConversionResponse> {
  const response = await fetch(`${API_BASE}/convert/base64`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: base64,
      settings,
      filename,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Conversion failed' }));
    throw new Error(error.error || 'Conversion failed');
  }

  return response.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
