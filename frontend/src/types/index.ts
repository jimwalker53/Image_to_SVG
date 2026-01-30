export type ConversionMode = 'silhouette' | 'multicolor' | 'lineart';
export type BackgroundHandling = 'transparent' | 'remove' | 'keep';
export type OutputUnit = 'inches' | 'mm';
export type ConversionStatus = 'idle' | 'processing' | 'success' | 'error';

export interface VectorizationSettings {
  mode: ConversionMode;
  detail: number;
  smoothing: number;
  colorLayers: number;
  minAreaThreshold: number;
  background: BackgroundHandling;
  targetWidth: number;
  targetHeight: number;
  unit: OutputUnit;
  threshold: number;
}

export interface LayerInfo {
  id: string;
  name: string;
  color: string;
  pathCount: number;
  pointCount: number;
  visible: boolean;
}

export interface ConversionStats {
  totalPaths: number;
  totalPoints: number;
  processingTimeMs: number;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
}

export interface ImageMetadata {
  name: string;
  size: number;
  type: string;
  width: number;
  height: number;
}

export interface ConversionResponse {
  svg: string;
  layers: Omit<LayerInfo, 'visible'>[];
  stats: ConversionStats;
  warning?: string;
  requestId: string;
}

export interface AppState {
  originalImage: {
    file: File | null;
    dataUrl: string | null;
    metadata: ImageMetadata | null;
  };
  settings: VectorizationSettings;
  svgData: {
    raw: string | null;
    layers: LayerInfo[];
  };
  conversionStatus: ConversionStatus;
  error: string | null;
  warning: string | null;
  stats: ConversionStats | null;
}

export const DEFAULT_SETTINGS: VectorizationSettings = {
  mode: 'silhouette',
  detail: 50,
  smoothing: 50,
  colorLayers: 4,
  minAreaThreshold: 0.1,
  background: 'transparent',
  targetWidth: 6,
  targetHeight: 6,
  unit: 'inches',
  threshold: 128,
};
