import { useCallback, useState } from 'react';
import type { ConversionStats, VectorizationSettings, LayerInfo } from '../types';

interface ExportPanelProps {
  svgData: string | null;
  stats: ConversionStats | null;
  settings: VectorizationSettings;
  layers: LayerInfo[];
  warning: string | null;
  originalFileName: string | null;
}

export function ExportPanel({
  svgData,
  stats,
  settings,
  layers,
  warning,
  originalFileName,
}: ExportPanelProps) {
  const [fileName, setFileName] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  const getDefaultFileName = useCallback(() => {
    if (originalFileName) {
      const base = originalFileName.replace(/\.[^/.]+$/, '');
      return `${base}_vector`;
    }
    return 'image_vector';
  }, [originalFileName]);

  const handleDownloadSVG = useCallback(() => {
    if (!svgData) return;

    const name = fileName.trim() || getDefaultFileName();
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [svgData, fileName, getDefaultFileName]);

  const handleDownloadBundle = useCallback(() => {
    if (!svgData) return;

    const name = fileName.trim() || getDefaultFileName();

    // Create settings JSON
    const projectData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings,
      layers: layers.map(l => ({
        id: l.id,
        name: l.name,
        color: l.color,
        pathCount: l.pathCount,
        pointCount: l.pointCount,
      })),
      stats,
    };

    // Create a simple bundle (in a real app, we'd use JSZip)
    // For now, just download the JSON separately
    const jsonBlob = new Blob([JSON.stringify(projectData, null, 2)], {
      type: 'application/json',
    });
    const jsonUrl = URL.createObjectURL(jsonBlob);

    const a = document.createElement('a');
    a.href = jsonUrl;
    a.download = `${name}_settings.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(jsonUrl);

    // Also download SVG
    handleDownloadSVG();
  }, [svgData, fileName, getDefaultFileName, settings, layers, stats, handleDownloadSVG]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Export</h2>

      {/* Warning */}
      {warning && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          <div className="flex gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{warning}</span>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Paths:</span>
            <span className="font-medium text-gray-800">{stats.totalPaths.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Points:</span>
            <span className="font-medium text-gray-800">{stats.totalPoints.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Output Size:</span>
            <span className="font-medium text-gray-800">
              {stats.outputWidth.toFixed(2)} x {stats.outputHeight.toFixed(2)} {settings.unit}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Processing Time:</span>
            <span className="font-medium text-gray-800">{stats.processingTimeMs}ms</span>
          </div>
        </div>
      )}

      {/* File Name Input */}
      {svgData && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">File Name</label>
          <div className="flex">
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder={getDefaultFileName()}
              className="flex-1 p-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600 text-sm">
              .svg
            </span>
          </div>
        </div>
      )}

      {/* Download Buttons */}
      <div className="space-y-2">
        <button
          onClick={handleDownloadSVG}
          disabled={!svgData}
          className={`
            w-full py-3 px-4 rounded-lg font-medium transition-all
            ${svgData
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download SVG
          </span>
        </button>

        <button
          onClick={handleDownloadBundle}
          disabled={!svgData}
          className={`
            w-full py-2 px-4 rounded-lg font-medium transition-all
            ${svgData
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            }
          `}
        >
          Download with Settings
        </button>
      </div>

      {/* Cricut Instructions */}
      <div className="border-t border-gray-200 pt-4">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="text-sm font-medium text-gray-700">Cricut Design Space Instructions</span>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${showInstructions ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showInstructions && (
          <div className="mt-3 p-4 bg-blue-50 rounded-lg text-sm space-y-3">
            <div className="space-y-2">
              <h4 className="font-medium text-blue-900">How to Import:</h4>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Open Cricut Design Space</li>
                <li>Click "Upload" in the left sidebar</li>
                <li>Click "Upload Image" then "Browse"</li>
                <li>Select your downloaded SVG file</li>
                <li>Click "Add to Canvas"</li>
              </ol>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-blue-900">Tips:</h4>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Set canvas units to {settings.unit} to match export size</li>
                <li>Use "Weld" to combine overlapping shapes</li>
                <li>Use "Attach" to keep pieces in position during cutting</li>
                <li>Each color layer can be set to a different cut type</li>
              </ul>
            </div>

            <div className="pt-2 border-t border-blue-200">
              <p className="text-blue-700 text-xs">
                The SVG contains vector paths compatible with Cut, Draw, and Score operations.
                No embedded raster images are included.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
