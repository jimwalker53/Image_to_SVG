import { useState, useCallback } from 'react';
import { UploadComponent } from './components/UploadComponent';
import { ControlsPanel } from './components/ControlsPanel';
import { SVGPreview } from './components/SVGPreview';
import { LayerList } from './components/LayerList';
import { ExportPanel } from './components/ExportPanel';
import { convertImage } from './services/api';
import type {
  AppState,
  VectorizationSettings,
  ImageMetadata,
  LayerInfo,
} from './types';
import { DEFAULT_SETTINGS } from './types';

const initialState: AppState = {
  originalImage: {
    file: null,
    dataUrl: null,
    metadata: null,
  },
  settings: DEFAULT_SETTINGS,
  svgData: {
    raw: null,
    layers: [],
  },
  conversionStatus: 'idle',
  error: null,
  warning: null,
  stats: null,
};

function App() {
  const [state, setState] = useState<AppState>(initialState);

  const handleImageSelect = useCallback((file: File, dataUrl: string, metadata: ImageMetadata) => {
    // Calculate target dimensions maintaining aspect ratio
    const aspectRatio = metadata.width / metadata.height;
    let targetWidth = state.settings.targetWidth;
    let targetHeight = state.settings.targetHeight;

    if (aspectRatio > 1) {
      targetHeight = targetWidth / aspectRatio;
    } else {
      targetWidth = targetHeight * aspectRatio;
    }

    setState(prev => ({
      ...prev,
      originalImage: { file, dataUrl, metadata },
      settings: {
        ...prev.settings,
        targetWidth: Math.round(targetWidth * 100) / 100,
        targetHeight: Math.round(targetHeight * 100) / 100,
      },
      svgData: { raw: null, layers: [] },
      conversionStatus: 'idle',
      error: null,
      warning: null,
      stats: null,
    }));
  }, [state.settings.targetWidth, state.settings.targetHeight]);

  const handleSettingsChange = useCallback((settings: VectorizationSettings) => {
    setState(prev => ({
      ...prev,
      settings,
    }));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!state.originalImage.file) return;

    setState(prev => ({
      ...prev,
      conversionStatus: 'processing',
      error: null,
      warning: null,
    }));

    try {
      const result = await convertImage(state.originalImage.file, state.settings);

      const layers: LayerInfo[] = result.layers.map(layer => ({
        ...layer,
        visible: true,
      }));

      setState(prev => ({
        ...prev,
        svgData: {
          raw: result.svg,
          layers,
        },
        conversionStatus: 'success',
        warning: result.warning || null,
        stats: result.stats,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        conversionStatus: 'error',
        error: error instanceof Error ? error.message : 'Conversion failed',
      }));
    }
  }, [state.originalImage.file, state.settings]);

  const handleLayerVisibilityChange = useCallback((layerId: string, visible: boolean) => {
    setState(prev => ({
      ...prev,
      svgData: {
        ...prev.svgData,
        layers: prev.svgData.layers.map(layer =>
          layer.id === layerId ? { ...layer, visible } : layer
        ),
      },
    }));
  }, []);

  const handleLayerReorder = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newLayers = [...prev.svgData.layers];
      const [moved] = newLayers.splice(fromIndex, 1);
      newLayers.splice(toIndex, 0, moved);
      return {
        ...prev,
        svgData: {
          ...prev.svgData,
          layers: newLayers,
        },
      };
    });
  }, []);

  const isProcessing = state.conversionStatus === 'processing';
  const hasImage = !!state.originalImage.file;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Image to SVG</h1>
              <p className="text-sm text-gray-500">Convert images to cuttable SVG for Cricut</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Upload & Controls */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <UploadComponent
                onImageSelect={handleImageSelect}
                currentImage={state.originalImage.dataUrl}
                metadata={state.originalImage.metadata}
              />
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
              <ControlsPanel
                settings={state.settings}
                onSettingsChange={handleSettingsChange}
                disabled={isProcessing}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!hasImage || isProcessing}
              className={`
                w-full py-3 px-4 rounded-xl font-semibold text-lg transition-all
                ${hasImage && !isProcessing
                  ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner"></span>
                  Converting...
                </span>
              ) : (
                'Generate SVG'
              )}
            </button>

            {/* Error Message */}
            {state.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {state.error}
              </div>
            )}
          </div>

          {/* Center - Preview */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <SVGPreview
                svgData={state.svgData.raw}
                layers={state.svgData.layers}
                isLoading={isProcessing}
              />
            </div>
          </div>

          {/* Right Sidebar - Layers & Export */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <LayerList
                layers={state.svgData.layers}
                onLayerVisibilityChange={handleLayerVisibilityChange}
                onLayerReorder={handleLayerReorder}
              />
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
              <ExportPanel
                svgData={state.svgData.raw}
                stats={state.stats}
                settings={state.settings}
                layers={state.svgData.layers}
                warning={state.warning}
                originalFileName={state.originalImage.metadata?.name || null}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>Outputs are compatible with Cricut Design Space. SVGs contain vector paths only (no embedded images).</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
