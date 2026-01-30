import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { vectorizer } from '../services/vectorizer.js';
import { DEFAULT_SETTINGS, type VectorizationSettings } from '../types/index.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PNG, JPG, JPEG, GIF, BMP'));
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

    // Check for complexity warning
    const complexityWarning = result.stats.totalPoints > 10000
      ? 'Warning: High path complexity may cause slowness in Cricut Design Space. Consider reducing detail or simplifying the image.'
      : null;

    return res.json({
      svg: result.svg,
      layers: result.layers,
      stats: result.stats,
      warning: complexityWarning,
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

    // Check for complexity warning
    const complexityWarning = result.stats.totalPoints > 10000
      ? 'Warning: High path complexity may cause slowness in Cricut Design Space. Consider reducing detail or simplifying the image.'
      : null;

    return res.json({
      svg: result.svg,
      layers: result.layers,
      stats: result.stats,
      warning: complexityWarning,
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

export default router;
