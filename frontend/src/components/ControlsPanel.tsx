import type { VectorizationSettings, ConversionMode, BackgroundHandling, OutputUnit } from '../types';

interface ControlsPanelProps {
  settings: VectorizationSettings;
  onSettingsChange: (settings: VectorizationSettings) => void;
  disabled?: boolean;
}

export function ControlsPanel({ settings, onSettingsChange, disabled }: ControlsPanelProps) {
  const updateSetting = <K extends keyof VectorizationSettings>(
    key: K,
    value: VectorizationSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Conversion Settings</h2>

      {/* Mode Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Mode</label>
        <div className="grid grid-cols-1 gap-2">
          {[
            { value: 'silhouette', label: 'Single Color Silhouette', desc: 'Best for logos and icons' },
            { value: 'multicolor', label: 'Multi-Color Layered', desc: 'Separate colors into layers' },
            { value: 'lineart', label: 'Line Art', desc: 'Trace edges and outlines' },
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
              <div className="font-medium text-gray-800">{mode.label}</div>
              <div className="text-xs text-gray-500">{mode.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Threshold (Silhouette mode only) */}
      {settings.mode === 'silhouette' && (
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-gray-700">Threshold</label>
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
            <span>Darker</span>
            <span>Lighter</span>
          </div>
        </div>
      )}

      {/* Detail Slider */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-gray-700">Detail Level</label>
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
          <span>Fewer points</span>
          <span>More points</span>
        </div>
      </div>

      {/* Smoothing Slider */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-gray-700">Smoothing</label>
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
            <div className="flex justify-between">
              <label className="text-sm font-medium text-gray-700">Number of Colors</label>
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
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-gray-700">Min Area Threshold</label>
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
        <label className="block text-sm font-medium text-gray-700">Background</label>
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
      </div>

      {/* Output Size */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Output Size</label>
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
      </div>

      {/* Cleanup Options (Silhouette mode only) */}
      {settings.mode === 'silhouette' && (
        <div className="space-y-4 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-700">Cleanup Options</h3>
          <p className="text-xs text-gray-500">Reduce weeding by removing unwanted areas</p>

          {/* Invert Toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.invert}
              onChange={(e) => updateSetting('invert', e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Invert Colors</span>
              <p className="text-xs text-gray-500">Cut white areas instead of black</p>
            </div>
          </label>

          {/* Remove Edge Regions Toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.removeEdgeRegions}
              onChange={(e) => updateSetting('removeEdgeRegions', e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Remove Edge Regions</span>
              <p className="text-xs text-gray-500">Remove ground/shadows touching borders</p>
            </div>
          </label>

          {/* Minimum Region Size */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-gray-700">Min Region Size</label>
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
            <p className="text-xs text-gray-400">Remove small isolated specks</p>
          </div>

          {/* Erosion Level */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-gray-700">Erosion Level</label>
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
            <p className="text-xs text-gray-400">Shrink regions to remove thin connections</p>
          </div>
        </div>
      )}
    </div>
  );
}
