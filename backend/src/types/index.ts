export type ConversionMode = 'silhouette' | 'multicolor' | 'lineart';
export type BackgroundHandling = 'transparent' | 'remove' | 'keep';
export type OutputUnit = 'inches' | 'mm';

export interface VectorizationSettings {
  mode: ConversionMode;
  detail: number; // 0-100, lower = fewer points
  smoothing: number; // 0-100, higher = smoother curves
  colorLayers: number; // Number of color layers for multicolor mode
  minAreaThreshold: number; // Minimum area for regions (percentage of total)
  background: BackgroundHandling;
  targetWidth: number;
  targetHeight: number;
  unit: OutputUnit;
  threshold?: number; // For silhouette mode (0-255)
}

export interface ConversionRequest {
  image: Buffer;
  settings: VectorizationSettings;
  filename: string;
}

export interface ConversionResult {
  svg: string;
  layers: LayerInfo[];
  stats: ConversionStats;
}

export interface LayerInfo {
  id: string;
  name: string;
  color: string;
  pathCount: number;
  pointCount: number;
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

export interface Point {
  x: number;
  y: number;
}

export interface PathData {
  points: Point[];
  closed: boolean;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface Layer {
  id: string;
  name: string;
  color: string;
  paths: PathData[];
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
