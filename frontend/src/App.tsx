import { useState, useCallback, useEffect } from 'react';
import { UploadComponent } from './components/UploadComponent';
import { ControlsPanel } from './components/ControlsPanel';
import { SVGPreview } from './components/SVGPreview';
import { LayerList } from './components/LayerList';
import { ExportPanel } from './components/ExportPanel';
import { OnboardingModal, shouldShowOnboarding, resetOnboarding } from './components/OnboardingModal';
import { WorkflowSteps, determineWorkflowStage } from './components/WorkflowSteps';
import { convertImage } from './services/api';
import { useHistory } from './hooks/useHistory';
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
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding());

  // Use history hook for settings with undo/redo
  const {
    state: settings,
    setState: setSettings,
    undo: undoSettings,
    redo: redoSettings,
    canUndo,
    canRedo,
    reset: resetSettings,
  } = useHistory<VectorizationSettings>(DEFAULT_SETTINGS);

  // Sync settings with state
  useEffect(() => {
    setState(prev => ({
      ...prev,
      settings,
    }));
  }, [settings]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z / Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undoSettings();
      }
      // Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y / Cmd+Y for redo
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        if (canRedo) redoSettings();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undoSettings, redoSettings]);

  const handleImageSelect = useCallback((file: File, dataUrl: string, metadata: ImageMetadata) => {
    // Calculate target dimensions maintaining aspect ratio
    const aspectRatio = metadata.width / metadata.height;
    let targetWidth = settings.targetWidth;
    let targetHeight = settings.targetHeight;

    if (aspectRatio > 1) {
      targetHeight = targetWidth / aspectRatio;
    } else {
      targetWidth = targetHeight * aspectRatio;
    }

    const newSettings = {
      ...settings,
      targetWidth: Math.round(targetWidth * 100) / 100,
      targetHeight: Math.round(targetHeight * 100) / 100,
    };

    // Reset history when new image is loaded
    resetSettings(newSettings);

    setState(prev => ({
      ...prev,
      originalImage: { file, dataUrl, metadata },
      settings: newSettings,
      svgData: { raw: null, layers: [] },
      conversionStatus: 'idle',
      error: null,
      warning: null,
      stats: null,
    }));
  }, [settings, resetSettings]);

  const handleSettingsChange = useCallback((newSettings: VectorizationSettings) => {
    setSettings(newSettings);
  }, [setSettings]);

  const handleGenerate = useCallback(async () => {
    if (!state.originalImage.file) return;

    setState(prev => ({
      ...prev,
      conversionStatus: 'processing',
      error: null,
      warning: null,
    }));

    try {
      const result = await convertImage(state.originalImage.file, settings);

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
  }, [state.originalImage.file, settings]);

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
  const hasSvg = !!state.svgData.raw;
  const workflowStage = determineWorkflowStage(hasImage, hasSvg, isProcessing);

  const handleShowTutorial = useCallback(() => {
    resetOnboarding();
    setShowOnboarding(true);
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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

            {/* Header actions */}
            <div className="flex items-center gap-4">
              {/* Show Tutorial button */}
              <button
                onClick={handleShowTutorial}
                className="text-sm text-gray-500 hover:text-primary-600 transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Tutorial
              </button>

              {/* Undo/Redo buttons */}
              <div className="flex items-center gap-1 border-l border-gray-200 pl-4">
                <button
                  onClick={undoSettings}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                  className={`
                    p-2 rounded-lg transition-all
                    ${canUndo
                      ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      : 'text-gray-300 cursor-not-allowed'
                    }
                  `}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
                <button
                  onClick={redoSettings}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Shift+Z)"
                  className={`
                    p-2 rounded-lg transition-all
                    ${canRedo
                      ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      : 'text-gray-300 cursor-not-allowed'
                    }
                  `}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Workflow Steps */}
      <WorkflowSteps
        currentStage={workflowStage}
        hasImage={hasImage}
        hasSvg={hasSvg}
      />

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
                settings={settings}
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
                settings={settings}
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
          <p className="mt-1 text-xs text-gray-400">
            Tip: Use Ctrl+Z to undo and Ctrl+Shift+Z to redo settings changes
          </p>
        </div>
      </footer>

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
      />
    </div>
  );
}

export default App;
