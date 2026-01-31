import type { VectorizationSettings, ConversionMode, BackgroundHandling, OutputUnit } from '../types';
import { HelpTooltip } from './HelpTooltip';

interface ControlsPanelProps {
  settings: VectorizationSettings;
  onSettingsChange: (settings: VectorizationSettings) => void;
  disabled?: boolean;
}

// Help text content for each setting
const HELP_TEXT = {
  mode: {
    silhouette: 'Converts your image to a single solid color. Best for logos, text, simple shapes, and designs that will be cut from one color of vinyl.',
    multicolor: 'Separates your image into multiple color layers. Each color becomes its own cut layer in Cricut Design Space. Great for colorful clipart and multi-color decals.',
    lineart: 'Traces the edges and outlines of your image. Creates line drawings from photos or artwork. Good for sketches and creating outline-only designs.',
  },
  threshold: 'Controls what becomes black vs white in the conversion. Lower values make more of the image turn black (more to cut). Higher values make more white (less to cut). Adjust until your subject is clearly separated from the background.',
  detail: 'Controls how closely the paths follow the original image. Higher values preserve more fine details but create larger files with more cutting paths. Lower values simplify shapes and reduce cut time.',
  smoothing: 'Controls how smooth the curves are. Higher values create smoother, more flowing lines but may lose sharp corners. Lower values preserve sharp angles but may look jagged on curves.',
  colorLayers: 'How many distinct colors to extract from your image. More colors = more accurate to original but more vinyl layers to cut and assemble. Start with fewer colors and increase if needed.',
  minAreaThreshold: 'Removes small color regions below this size. Helps eliminate tiny specks and noise that would be difficult to weed. Higher values remove more small pieces.',
  background: {
    transparent: 'Preserves any transparent areas from your original PNG image. Those areas will not be cut.',
    remove: 'Attempts to detect and remove a solid-colored background. The detected background color will not be cut.',
    keep: 'Includes the background as its own separate layer that can be cut from a different material.',
  },
  outputSize: 'Sets the physical dimensions of your SVG when imported into Cricut Design Space. The design will appear at exactly this size on your canvas.',
  unit: 'Choose inches for US measurements or millimeters for metric. This affects how your design size displays in Cricut Design Space.',
  invert: 'Swaps what gets cut vs what gets removed. Normally black areas are cut. When inverted, white areas are cut instead. Useful when your subject is lighter than the background.',
  removeEdgeRegions: {
    silhouette: 'Removes any black areas that touch the image border. Great for removing ground shadows, backgrounds, or other elements connected to the edges.',
    multicolor: 'Removes regions touching image borders from each color layer. Helps clean up edge artifacts and unwanted background elements.',
    lineart: 'Removes edge-connected line segments. Useful for cleaning up border artifacts in traced outlines.',
  },
  minRegionSize: {
    silhouette: 'Removes isolated black areas smaller than this percentage. Helps eliminate small specks, noise, and tiny details that would be hard to weed.',
    multicolor: 'Removes small isolated regions from each color layer. Cleans up tiny specks and color artifacts for easier weeding.',
    lineart: 'Removes small isolated line segments. Helps clean up noise and minor edge artifacts from the trace.',
  },
  erosionLevel: {
    silhouette: 'Shrinks all black regions by this many pixels. Helps remove thin connecting lines and clean up edges.',
    multicolor: 'Shrinks each color region. Helps separate colors that bleed into each other and removes thin connections.',
    lineart: 'Thins the traced lines. Can help clean up thick or blobby line traces.',
  },
  cleanup: {
    silhouette: 'These options help reduce the amount of vinyl you need to weed by removing unwanted dark areas like shadows, ground, or small specks.',
    multicolor: 'These options help clean up each color layer by removing small artifacts, edge-connected regions, and thinning the cut areas.',
    lineart: 'These options help clean up the line trace by removing noise, small segments, and edge artifacts.',
  },
};

export function ControlsPanel({ settings, onSettingsChange, disabled }: ControlsPanelProps) {
  const updateSetting = <K extends keyof VectorizationSettings>(
    key: K,
    value: VectorizationSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  // Preset definitions
  const PRESETS = {
    singleColorDecal: {
      name: 'Single Color Decal',
      description: 'Simple vinyl decal with clean edges',
      settings: {
        mode: 'silhouette' as const,
        detail: 40,
        smoothing: 70,
        threshold: 128,
        removeEdgeRegions: true,
        minRegionSize: 1,
        erosionLevel: 1,
        invert: false,
      },
    },
    multiColorVinyl: {
      name: 'Multi-Color Vinyl',
      description: 'Layered design with 4-6 colors',
      settings: {
        mode: 'multicolor' as const,
        detail: 50,
        smoothing: 60,
        colorLayers: 5,
        minAreaThreshold: 0.5,
        removeEdgeRegions: true,
        minRegionSize: 0.5,
        erosionLevel: 1,
      },
    },
    stencil: {
      name: 'Stencil',
      description: 'Outlines for painting or etching',
      settings: {
        mode: 'lineart' as const,
        detail: 60,
        smoothing: 50,
        removeEdgeRegions: false,
        minRegionSize: 0.5,
        erosionLevel: 0,
      },
    },
    detailedPrint: {
      name: 'Detailed HTV',
      description: 'High-detail for heat transfer vinyl',
      settings: {
        mode: 'silhouette' as const,
        detail: 75,
        smoothing: 40,
        threshold: 128,
        removeEdgeRegions: false,
        minRegionSize: 0,
        erosionLevel: 0,
        invert: false,
      },
    },
  };

  // Apply a preset
  const applyPreset = (presetKey: keyof typeof PRESETS) => {
    const preset = PRESETS[presetKey];
    onSettingsChange({
      ...settings,
      ...preset.settings,
    });
  };

  // Apply minimal weeding preset (cleanup only)
  const applyMinimalWeedingPreset = () => {
    onSettingsChange({
      ...settings,
      removeEdgeRegions: true,
      minRegionSize: 1.5,
      erosionLevel: 2,
    });
  };

  // Check if minimal weeding preset is active
  const isMinimalWeedingActive =
    settings.removeEdgeRegions &&
    settings.minRegionSize >= 1 &&
    settings.erosionLevel >= 1;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Conversion Settings</h2>

      {/* Quick Start Presets */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-700">Quick Start Presets</label>
          <HelpTooltip text="Choose a preset to automatically configure all settings for common use cases. You can customize settings after applying a preset." />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(key as keyof typeof PRESETS)}
              disabled={disabled}
              className={`
                p-2 rounded-lg border text-left transition-all text-sm
                border-gray-200 hover:border-primary-400 hover:bg-primary-50
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="font-medium text-gray-800">{preset.name}</div>
              <div className="text-xs text-gray-500">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Mode Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-700">Mode</label>
          <HelpTooltip text="Choose how your image will be converted to a cuttable design. Each mode works best for different types of images." />
        </div>
        <div className="grid grid-cols-1 gap-2">
          {[
            { value: 'silhouette', label: 'Single Color Silhouette', desc: 'Best for logos and icons', help: HELP_TEXT.mode.silhouette },
            { value: 'multicolor', label: 'Multi-Color Layered', desc: 'Separate colors into layers', help: HELP_TEXT.mode.multicolor },
            { value: 'lineart', label: 'Line Art', desc: 'Trace edges and outlines', help: HELP_TEXT.mode.lineart },
          ].map(mode => (
            <button
              key={mode.value}
              onClick={() => updateSetting('mode', mode.value as ConversionMode)}
              disabled={disabled}
              className={`
                p-3 rounded-lg border text-left transition-all
                ${settings.mode === mode.value
                  ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800">{mode.label}</span>
                <HelpTooltip text={mode.help} />
              </div>
              <div className="text-xs text-gray-500">{mode.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Threshold (Silhouette mode only) */}
      {settings.mode === 'silhouette' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Threshold</label>
              <HelpTooltip text={HELP_TEXT.threshold} />
            </div>
            <span className="text-sm text-gray-500">{settings.threshold}</span>
          </div>
          <input
            type="range"
            min="0"
            max="255"
            value={settings.threshold}
            onChange={(e) => updateSetting('threshold', parseInt(e.target.value))}
            disabled={disabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>Darker (more black)</span>
            <span>Lighter (less black)</span>
          </div>
        </div>
      )}

      {/* Detail Slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Detail Level</label>
            <HelpTooltip text={HELP_TEXT.detail} />
          </div>
          <span className="text-sm text-gray-500">{settings.detail}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.detail}
          onChange={(e) => updateSetting('detail', parseInt(e.target.value))}
          disabled={disabled}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>Simplified (faster cuts)</span>
          <span>Detailed (complex cuts)</span>
        </div>
      </div>

      {/* Smoothing Slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Smoothing</label>
            <HelpTooltip text={HELP_TEXT.smoothing} />
          </div>
          <span className="text-sm text-gray-500">{settings.smoothing}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.smoothing}
          onChange={(e) => updateSetting('smoothing', parseInt(e.target.value))}
          disabled={disabled}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>Sharp corners</span>
          <span>Smooth curves</span>
        </div>
      </div>

      {/* Color Layers (Multicolor mode only) */}
      {settings.mode === 'multicolor' && (
        <>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Number of Colors</label>
                <HelpTooltip text={HELP_TEXT.colorLayers} />
              </div>
              <span className="text-sm text-gray-500">{settings.colorLayers}</span>
            </div>
            <input
              type="range"
              min="2"
              max="12"
              value={settings.colorLayers}
              onChange={(e) => updateSetting('colorLayers', parseInt(e.target.value))}
              disabled={disabled}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>2 colors (simpler)</span>
              <span>12 colors (detailed)</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Min Area Threshold</label>
                <HelpTooltip text={HELP_TEXT.minAreaThreshold} />
              </div>
              <span className="text-sm text-gray-500">{settings.minAreaThreshold}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={settings.minAreaThreshold}
              onChange={(e) => updateSetting('minAreaThreshold', parseFloat(e.target.value))}
              disabled={disabled}
              className="w-full"
            />
            <p className="text-xs text-gray-400">Remove small regions below this threshold</p>
          </div>
        </>
      )}

      {/* Background Handling */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-700">Background</label>
          <HelpTooltip text="Choose how to handle the background of your image. This affects what gets included in your cut file." />
        </div>
        <select
          value={settings.background}
          onChange={(e) => updateSetting('background', e.target.value as BackgroundHandling)}
          disabled={disabled}
          className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="transparent">Keep transparent areas</option>
          <option value="remove">Remove solid background</option>
          <option value="keep">Keep as separate layer</option>
        </select>
        <p className="text-xs text-gray-400">
          {settings.background === 'transparent' && HELP_TEXT.background.transparent}
          {settings.background === 'remove' && HELP_TEXT.background.remove}
          {settings.background === 'keep' && HELP_TEXT.background.keep}
        </p>
      </div>

      {/* Output Size */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-700">Output Size</label>
          <HelpTooltip text={HELP_TEXT.outputSize} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Width</label>
            <div className="flex">
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={settings.targetWidth}
                onChange={(e) => updateSetting('targetWidth', parseFloat(e.target.value) || 1)}
                disabled={disabled}
                className="w-full p-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600 text-sm">
                {settings.unit}
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Height</label>
            <div className="flex">
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={settings.targetHeight}
                onChange={(e) => updateSetting('targetHeight', parseFloat(e.target.value) || 1)}
                disabled={disabled}
                className="w-full p-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600 text-sm">
                {settings.unit}
              </span>
            </div>
          </div>
        </div>

        {/* Unit Selection */}
        <div className="flex gap-2">
          {(['inches', 'mm'] as OutputUnit[]).map(unit => (
            <button
              key={unit}
              onClick={() => updateSetting('unit', unit)}
              disabled={disabled}
              className={`
                flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all
                ${settings.unit === unit
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {unit === 'inches' ? 'Inches' : 'Millimeters'}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400">{HELP_TEXT.unit}</p>
      </div>

      {/* Cleanup Options (All modes) */}
      <div className="space-y-4 border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Cleanup Options</h3>
            <p className="text-xs text-gray-500">
              {settings.mode === 'silhouette' && 'Reduce weeding by removing unwanted areas'}
              {settings.mode === 'multicolor' && 'Clean up color layers for easier weeding'}
              {settings.mode === 'lineart' && 'Clean up traced lines and remove artifacts'}
            </p>
          </div>
          <HelpTooltip text={HELP_TEXT.cleanup[settings.mode]} />
        </div>

        {/* Minimal Weeding Preset Button */}
        <button
          onClick={applyMinimalWeedingPreset}
          disabled={disabled}
          className={`
            w-full py-2 px-4 rounded-lg text-sm font-medium transition-all border-2
            ${isMinimalWeedingActive
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-primary-500 bg-primary-50 text-primary-700 hover:bg-primary-100'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <div className="flex items-center justify-center gap-2">
            {isMinimalWeedingActive ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Minimal Weeding Active</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Apply Minimal Weeding Preset</span>
              </>
            )}
          </div>
        </button>
        <p className="text-xs text-gray-500 text-center">
          Automatically configures settings to reduce weeding effort
        </p>

        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500 mb-3">Or customize individual options:</p>

          {/* Invert Toggle (Silhouette mode only) */}
          {settings.mode === 'silhouette' && (
            <label className="flex items-start gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={settings.invert}
                onChange={(e) => updateSetting('invert', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Invert Colors</span>
                  <HelpTooltip text={HELP_TEXT.invert} />
                </div>
                <p className="text-xs text-gray-500">Cut white areas instead of black</p>
              </div>
            </label>
          )}

          {/* Remove Edge Regions Toggle */}
          <label className="flex items-start gap-3 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={settings.removeEdgeRegions}
              onChange={(e) => updateSetting('removeEdgeRegions', e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Remove Edge Regions</span>
                <HelpTooltip text={HELP_TEXT.removeEdgeRegions[settings.mode]} />
              </div>
              <p className="text-xs text-gray-500">
                {settings.mode === 'silhouette' && 'Remove ground/shadows touching borders'}
                {settings.mode === 'multicolor' && 'Remove border-touching areas from layers'}
                {settings.mode === 'lineart' && 'Remove edge-connected line segments'}
              </p>
            </div>
          </label>

          {/* Minimum Region Size */}
          <div className="space-y-2 mb-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Min Region Size</label>
                <HelpTooltip text={HELP_TEXT.minRegionSize[settings.mode]} />
              </div>
              <span className="text-sm text-gray-500">{settings.minRegionSize}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={settings.minRegionSize}
              onChange={(e) => updateSetting('minRegionSize', parseFloat(e.target.value))}
              disabled={disabled}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>Keep all (0%)</span>
              <span>Remove small (5%)</span>
            </div>
          </div>

          {/* Erosion Level */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">
                  {settings.mode === 'lineart' ? 'Line Thinning' : 'Erosion Level'}
                </label>
                <HelpTooltip text={HELP_TEXT.erosionLevel[settings.mode]} />
              </div>
              <span className="text-sm text-gray-500">{settings.erosionLevel}</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="1"
              value={settings.erosionLevel}
              onChange={(e) => updateSetting('erosionLevel', parseInt(e.target.value))}
              disabled={disabled}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>None (0)</span>
              <span>Heavy (5)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
