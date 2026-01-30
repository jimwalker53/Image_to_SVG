import { useCallback } from 'react';
import type { LayerInfo } from '../types';

interface LayerListProps {
  layers: LayerInfo[];
  onLayerVisibilityChange: (layerId: string, visible: boolean) => void;
  onLayerReorder: (fromIndex: number, toIndex: number) => void;
}

export function LayerList({ layers, onLayerVisibilityChange, onLayerReorder }: LayerListProps) {
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (fromIndex !== toIndex) {
      onLayerReorder(fromIndex, toIndex);
    }
  }, [onLayerReorder]);

  const toggleVisibility = useCallback((layer: LayerInfo) => {
    onLayerVisibilityChange(layer.id, !layer.visible);
  }, [onLayerVisibilityChange]);

  if (layers.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Layers</h2>
        <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500 text-sm">
          No layers yet. Generate an SVG to see layers here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">Layers ({layers.length})</h2>

      <div className="space-y-1">
        {layers.map((layer, index) => (
          <div
            key={layer.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            className="layer-item bg-white border border-gray-200 rounded-lg cursor-move"
          >
            {/* Visibility Toggle */}
            <button
              onClick={() => toggleVisibility(layer)}
              className="p-1 rounded hover:bg-gray-100"
              title={layer.visible ? 'Hide layer' : 'Show layer'}
            >
              {layer.visible ? (
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              )}
            </button>

            {/* Color Swatch */}
            <div
              className="w-6 h-6 rounded border border-gray-300 flex-shrink-0"
              style={{ backgroundColor: layer.color }}
              title={layer.color}
            />

            {/* Layer Info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-800 text-sm truncate">
                {layer.name}
              </div>
              <div className="text-xs text-gray-500">
                {layer.pathCount} paths, {layer.pointCount} points
              </div>
            </div>

            {/* Drag Handle */}
            <div className="text-gray-400" title="Drag to reorder">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 8h16M4 16h16" />
              </svg>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        Drag layers to reorder. Click eye icon to toggle visibility.
      </p>
    </div>
  );
}
