import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { vectorizer } from '../services/vectorizer.js';
import { DEFAULT_SETTINGS, type VectorizationSettings, type ConversionResult } from '../types/index.js';

// Cricut Design Space limits and thresholds
const CRICUT_LIMITS = {
  MAX_FILE_SIZE_BYTES: 2 * 1024 * 1024, // 2MB recommended
  MAX_DIMENSION_INCHES: 23.5, // Standard Cricut Maker mat width
  MAX_PATHS: 5000,
  MAX_POINTS: 10000,
  WARN_PATHS: 2000,
  WARN_POINTS: 5000,
};

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/bmp',
      'image/webp',
      'image/heic',
      'image/heif',
    ];
    // Also check file extension for HEIC which may have incorrect MIME type
    const ext = file.originalname.toLowerCase().split('.').pop();
    if (allowedMimes.includes(file.mimetype) || ['heic', 'heif', 'webp'].includes(ext || '')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PNG, JPG, WebP, HEIC, GIF, BMP'));
    }
  },
});

/**
 * POST /api/convert
 * Convert an uploaded image to SVG
 */
router.post('/', upload.single('image'), async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  console.log(`[${requestId}] Starting conversion request`);

  try {
    // Validate image upload
    if (!req.file) {
      return res.status(400).json({
        error: 'No image file provided',
        requestId,
      });
    }

    // Parse settings from request body
    let settings: VectorizationSettings;

    try {
      if (req.body.settings) {
        const parsedSettings = typeof req.body.settings === 'string'
          ? JSON.parse(req.body.settings)
          : req.body.settings;

        settings = {
          ...DEFAULT_SETTINGS,
          ...parsedSettings,
        };
      } else {
        settings = { ...DEFAULT_SETTINGS };
      }
    } catch (e) {
      return res.status(400).json({
        error: 'Invalid settings format',
        requestId,
      });
    }

    // Validate settings
    const validationError = validateSettings(settings);
    if (validationError) {
      return res.status(400).json({
        error: validationError,
        requestId,
      });
    }

    console.log(`[${requestId}] Processing image: ${req.file.originalname}, mode: ${settings.mode}`);

    // Perform conversion
    const result = await vectorizer.convert(req.file.buffer, settings);

    const runtime = Date.now() - startTime;
    console.log(`[${requestId}] Conversion complete in ${runtime}ms`);

    // Check for Cricut-aware warnings
    const warnings = generateCricutWarnings(result, settings);

    return res.json({
      svg: result.svg,
      layers: result.layers,
      stats: {
        ...result.stats,
        svgSizeBytes: Buffer.byteLength(result.svg, 'utf8'),
      },
      warnings,
      warning: warnings.length > 0 ? warnings[0] : null,
      requestId,
    });

  } catch (error) {
    const runtime = Date.now() - startTime;
    console.error(`[${requestId}] Conversion failed after ${runtime}ms:`, error);

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Conversion failed',
      requestId,
    });
  }
});

/**
 * POST /api/convert/base64
 * Convert a base64-encoded image to SVG
 */
router.post('/base64', async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  console.log(`[${requestId}] Starting base64 conversion request`);

  try {
    const { image, settings: requestSettings, filename } = req.body;

    if (!image) {
      return res.status(400).json({
        error: 'No image data provided',
        requestId,
      });
    }

    // Parse base64 image
    let imageBuffer: Buffer;
    try {
      // Handle data URL format
      const base64Data = image.includes(',') ? image.split(',')[1] : image;
      imageBuffer = Buffer.from(base64Data, 'base64');
    } catch (e) {
      return res.status(400).json({
        error: 'Invalid base64 image data',
        requestId,
      });
    }

    // Check file size
    if (imageBuffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({
        error: 'Image size exceeds 10MB limit',
        requestId,
      });
    }

    // Parse settings
    const settings: VectorizationSettings = {
      ...DEFAULT_SETTINGS,
      ...(requestSettings || {}),
    };

    // Validate settings
    const validationError = validateSettings(settings);
    if (validationError) {
      return res.status(400).json({
        error: validationError,
        requestId,
      });
    }

    console.log(`[${requestId}] Processing base64 image, mode: ${settings.mode}`);

    // Perform conversion
    const result = await vectorizer.convert(imageBuffer, settings);

    const runtime = Date.now() - startTime;
    console.log(`[${requestId}] Conversion complete in ${runtime}ms`);

    // Check for Cricut-aware warnings
    const warnings = generateCricutWarnings(result, settings);

    return res.json({
      svg: result.svg,
      layers: result.layers,
      stats: {
        ...result.stats,
        svgSizeBytes: Buffer.byteLength(result.svg, 'utf8'),
      },
      warnings,
      warning: warnings.length > 0 ? warnings[0] : null,
      requestId,
    });

  } catch (error) {
    const runtime = Date.now() - startTime;
    console.error(`[${requestId}] Base64 conversion failed after ${runtime}ms:`, error);

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Conversion failed',
      requestId,
    });
  }
});

/**
 * Validate vectorization settings
 */
function validateSettings(settings: VectorizationSettings): string | null {
  if (!['silhouette', 'multicolor', 'lineart'].includes(settings.mode)) {
    return 'Invalid mode. Must be: silhouette, multicolor, or lineart';
  }

  if (settings.detail < 0 || settings.detail > 100) {
    return 'Detail must be between 0 and 100';
  }

  if (settings.smoothing < 0 || settings.smoothing > 100) {
    return 'Smoothing must be between 0 and 100';
  }

  if (settings.colorLayers < 2 || settings.colorLayers > 16) {
    return 'Color layers must be between 2 and 16';
  }

  if (settings.targetWidth <= 0 || settings.targetHeight <= 0) {
    return 'Target dimensions must be positive';
  }

  if (settings.targetWidth > 100 || settings.targetHeight > 100) {
    return 'Target dimensions cannot exceed 100 inches/mm';
  }

  if (!['inches', 'mm'].includes(settings.unit)) {
    return 'Unit must be: inches or mm';
  }

  if (!['transparent', 'remove', 'keep'].includes(settings.background)) {
    return 'Background handling must be: transparent, remove, or keep';
  }

  return null;
}

/**
 * Generate Cricut-aware warnings based on conversion result
 */
function generateCricutWarnings(
  result: ConversionResult,
  settings: VectorizationSettings
): string[] {
  const warnings: string[] = [];
  const svgSize = Buffer.byteLength(result.svg, 'utf8');

  // File size warning (Cricut Design Space may struggle with large files)
  if (svgSize > CRICUT_LIMITS.MAX_FILE_SIZE_BYTES) {
    const sizeMB = (svgSize / (1024 * 1024)).toFixed(1);
    warnings.push(
      `Large file size (${sizeMB}MB). Files over 2MB may upload slowly or fail in Cricut Design Space. Consider reducing detail level.`
    );
  }

  // Path count warning
  if (result.stats.totalPaths > CRICUT_LIMITS.MAX_PATHS) {
    warnings.push(
      `Very high path count (${result.stats.totalPaths.toLocaleString()}). This may cause Cricut Design Space to freeze. Reduce detail or simplify the image.`
    );
  } else if (result.stats.totalPaths > CRICUT_LIMITS.WARN_PATHS) {
    warnings.push(
      `High path count (${result.stats.totalPaths.toLocaleString()}). Complex designs may cut slowly. Consider reducing detail.`
    );
  }

  // Point count warning
  if (result.stats.totalPoints > CRICUT_LIMITS.MAX_POINTS) {
    warnings.push(
      `Very high point count (${result.stats.totalPoints.toLocaleString()}). This complexity may cause issues in Cricut Design Space.`
    );
  } else if (result.stats.totalPoints > CRICUT_LIMITS.WARN_POINTS) {
    warnings.push(
      `High point count (${result.stats.totalPoints.toLocaleString()}). Complex paths may slow down Design Space.`
    );
  }

  // Dimension warnings
  const maxDimension = Math.max(settings.targetWidth, settings.targetHeight);
  const dimensionInInches = settings.unit === 'mm' ? maxDimension / 25.4 : maxDimension;

  if (dimensionInInches > CRICUT_LIMITS.MAX_DIMENSION_INCHES) {
    warnings.push(
      `Design is ${dimensionInInches.toFixed(1)}" wide/tall, exceeding standard Cricut mat size (${CRICUT_LIMITS.MAX_DIMENSION_INCHES}"). You may need to resize or tile the design.`
    );
  }

  // Layer count warning for multicolor
  if (result.layers.length > 8) {
    warnings.push(
      `Many color layers (${result.layers.length}). Each layer requires separate vinyl and alignment. Consider reducing colors.`
    );
  }

  return warnings;
}

export default router;
