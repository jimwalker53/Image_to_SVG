import { useCallback, useRef, useState } from 'react';
import type { ImageMetadata } from '../types';

interface UploadComponentProps {
  onImageSelect: (file: File, dataUrl: string, metadata: ImageMetadata) => void;
  currentImage: string | null;
  metadata: ImageMetadata | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DIMENSION = 4000;
const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/heic',
  'image/heif',
];

export function UploadComponent({ onImageSelect, currentImage, metadata }: UploadComponentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndProcessFile = useCallback(async (file: File) => {
    setError(null);

    // Validate file type - also check file extension for HEIC which may not have correct MIME
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const isValidType = ACCEPTED_TYPES.includes(file.type) ||
      ['heic', 'heif', 'webp'].includes(fileExtension || '');

    if (!isValidType) {
      setError('Invalid file type. Please upload PNG, JPG, GIF, BMP, WebP, or HEIC images.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('File size exceeds 10MB limit.');
      return;
    }

    // Read file and get dimensions
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Validate dimensions
        if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
          setError(`Image dimensions exceed ${MAX_DIMENSION}x${MAX_DIMENSION} pixels.`);
          return;
        }

        const imageMetadata: ImageMetadata = {
          name: file.name,
          size: file.size,
          type: file.type,
          width: img.width,
          height: img.height,
        };

        onImageSelect(file, dataUrl, imageMetadata);
      };
      img.onerror = () => {
        setError('Failed to load image. The file may be corrupted.');
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setError('Failed to read file.');
    };
    reader.readAsDataURL(file);
  }, [onImageSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndProcessFile(files[0]);
    }
  }, [validateAndProcessFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndProcessFile(files[0]);
    }
  }, [validateAndProcessFile]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Upload Image</h2>

      {/* Dropzone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.gif,.bmp,.webp,.heic,.heif"
          onChange={handleFileSelect}
          className="hidden"
        />

        {currentImage ? (
          <div className="space-y-3">
            <img
              src={currentImage}
              alt="Preview"
              className="max-h-48 max-w-full mx-auto rounded-lg shadow-sm"
            />
            <p className="text-sm text-gray-600">Click or drag to replace image</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="mx-auto w-12 h-12 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <p className="text-gray-700 font-medium">Drop your image here</p>
              <p className="text-sm text-gray-500">or click to browse</p>
            </div>
            <p className="text-xs text-gray-400">
              PNG, JPG, WebP, HEIC, GIF, BMP up to 10MB
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* File info */}
      {metadata && (
        <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">File:</span>
            <span className="font-medium text-gray-800 truncate max-w-[200px]">{metadata.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Dimensions:</span>
            <span className="font-medium text-gray-800">{metadata.width} x {metadata.height} px</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Size:</span>
            <span className="font-medium text-gray-800">{formatFileSize(metadata.size)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
