import Jimp from 'jimp';
import potrace, { type PotraceOptions } from 'potrace';
import type {
  VectorizationSettings,
  ConversionResult,
  Layer,
  LayerInfo,
  PathData,
  Point,
} from '../types/index.js';
import {
  simplifyPath,
  smoothPath,
  calculatePolygonArea,
  countPoints,
} from '../utils/pathUtils.js';
import {
  kMeansQuantize,
  rgbToHex,
  findBackgroundColor,
  colorDistance,
  sortColorsByLuminance,
  type RGBA,
  type RGB,
} from '../utils/colorUtils.js';

// Custom promisify wrapper for potrace.trace
function potraceTrace(file: Buffer, options: PotraceOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(file, options, (err, svg) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

// Maximum image dimension for processing
const MAX_DIMENSION = 4000;
const DEFAULT_DPI = 96;

export class Vectorizer {
  /**
   * Main conversion entry point
   */
  async convert(
    imageBuffer: Buffer,
    settings: VectorizationSettings
  ): Promise<ConversionResult> {
    const startTime = Date.now();

    // Load and preprocess image
    const image = await Jimp.read(imageBuffer);
    const originalWidth = image.getWidth();
    const originalHeight = image.getHeight();

    // Resize if needed
    if (originalWidth > MAX_DIMENSION || originalHeight > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(originalWidth, originalHeight);
      image.scale(scale);
    }

    let layers: Layer[];

    switch (settings.mode) {
      case 'silhouette':
        layers = await this.processSilhouette(image, settings);
        break;
      case 'multicolor':
        layers = await this.processMulticolor(image, settings);
        break;
      case 'lineart':
        layers = await this.processLineart(image, settings);
        break;
      default:
        throw new Error(`Unknown conversion mode: ${settings.mode}`);
    }

    // Generate SVG
    const svg = this.generateSVG(layers, settings, image.getWidth(), image.getHeight());

    // Compute stats
    const layerInfos: LayerInfo[] = layers.map(layer => ({
      id: layer.id,
      name: layer.name,
      color: layer.color,
      pathCount: layer.paths.length,
      pointCount: countPoints(layer.paths),
    }));

    const stats = {
      totalPaths: layers.reduce((sum, l) => sum + l.paths.length, 0),
      totalPoints: layers.reduce((sum, l) => sum + countPoints(l.paths), 0),
      processingTimeMs: Date.now() - startTime,
      originalWidth,
      originalHeight,
      outputWidth: settings.targetWidth,
      outputHeight: settings.targetHeight,
    };

    return { svg, layers: layerInfos, stats };
  }

  /**
   * Process image in silhouette (single color) mode
   */
  private async processSilhouette(
    image: Jimp,
    settings: VectorizationSettings
  ): Promise<Layer[]> {
    // Convert to grayscale and apply threshold
    const processed = image.clone().grayscale();

    // Get pixel data for background detection
    const width = processed.getWidth();
    const height = processed.getHeight();
    const pixels: RGBA[] = [];

    processed.scan(0, 0, width, height, (x, y, idx) => {
      pixels.push({
        r: processed.bitmap.data[idx],
        g: processed.bitmap.data[idx + 1],
        b: processed.bitmap.data[idx + 2],
        a: processed.bitmap.data[idx + 3],
      });
    });

    // Handle background
    if (settings.background === 'remove') {
      const bgColor = findBackgroundColor(pixels, width, height);
      if (bgColor) {
        // Make background color transparent
        processed.scan(0, 0, width, height, (x, y, idx) => {
          const pixel: RGB = {
            r: processed.bitmap.data[idx],
            g: processed.bitmap.data[idx + 1],
            b: processed.bitmap.data[idx + 2],
          };
          if (colorDistance(pixel, bgColor) < 30) {
            processed.bitmap.data[idx + 3] = 0; // Make transparent
          }
        });
      }
    }

    // Apply threshold
    const threshold = settings.threshold ?? 128;
    processed.scan(0, 0, width, height, (x, y, idx) => {
      const gray = processed.bitmap.data[idx];
      const alpha = processed.bitmap.data[idx + 3];
      const value = alpha > 128 && gray < threshold ? 0 : 255;
      processed.bitmap.data[idx] = value;
      processed.bitmap.data[idx + 1] = value;
      processed.bitmap.data[idx + 2] = value;
    });

    // Convert to buffer for potrace
    const pngBuffer = await processed.getBufferAsync(Jimp.MIME_PNG);

    // Trace with potrace
    const tolerance = this.detailToTolerance(settings.detail);
    const svgString = await potraceTrace(pngBuffer, {
      turdSize: Math.max(2, Math.floor((100 - settings.detail) / 10)),
      optTolerance: tolerance,
      threshold: threshold,
    });

    // Parse paths from SVG
    const paths = this.parseSVGPaths(svgString , settings);

    return [{
      id: 'layer-0',
      name: 'Silhouette',
      color: '#000000',
      paths,
    }];
  }

  /**
   * Process image in multi-color mode
   */
  private async processMulticolor(
    image: Jimp,
    settings: VectorizationSettings
  ): Promise<Layer[]> {
    const width = image.getWidth();
    const height = image.getHeight();

    // Extract pixels
    const pixels: RGBA[] = [];
    image.scan(0, 0, width, height, (x, y, idx) => {
      pixels.push({
        r: image.bitmap.data[idx],
        g: image.bitmap.data[idx + 1],
        b: image.bitmap.data[idx + 2],
        a: image.bitmap.data[idx + 3],
      });
    });

    // Handle background removal
    let bgColorIndex = -1;
    if (settings.background === 'remove') {
      const bgColor = findBackgroundColor(pixels, width, height);
      if (bgColor) {
        // Mark background pixels as transparent
        pixels.forEach((pixel, i) => {
          if (colorDistance(pixel, bgColor) < 30) {
            pixels[i].a = 0;
          }
        });
      }
    }

    // Quantize colors
    const { palette, assignments } = kMeansQuantize(pixels, settings.colorLayers);

    // Sort palette by luminance for consistent layer ordering
    const sortedPalette = sortColorsByLuminance(palette);
    const paletteMap = new Map<number, number>();
    palette.forEach((color, oldIndex) => {
      const newIndex = sortedPalette.findIndex(
        c => c.r === color.r && c.g === color.g && c.b === color.b
      );
      paletteMap.set(oldIndex, newIndex);
    });

    // Create layers for each color
    const layers: Layer[] = [];

    for (let colorIndex = 0; colorIndex < sortedPalette.length; colorIndex++) {
      const color = sortedPalette[colorIndex];

      // Skip if this is background color and we're removing it
      if (settings.background === 'remove' && colorIndex === bgColorIndex) {
        continue;
      }

      // Create binary image for this color
      const colorImage = new Jimp(width, height, 0xffffffff);

      assignments.forEach((assignment, i) => {
        if (assignment === -1) return; // Transparent pixel

        const mappedAssignment = paletteMap.get(assignment);
        if (mappedAssignment === colorIndex) {
          const x = i % width;
          const y = Math.floor(i / width);
          colorImage.setPixelColor(0x000000ff, x, y);
        }
      });

      // Trace this color layer
      const pngBuffer = await colorImage.getBufferAsync(Jimp.MIME_PNG);
      const tolerance = this.detailToTolerance(settings.detail);

      try {
        const svgString = await potraceTrace(pngBuffer, {
          turdSize: Math.max(2, Math.floor((100 - settings.detail) / 10)),
          optTolerance: tolerance,
          threshold: 128,
        });

        const paths = this.parseSVGPaths(svgString , settings);

        // Filter out small paths
        const minArea = (width * height * settings.minAreaThreshold) / 100;
        const filteredPaths = paths.filter(path => {
          const area = calculatePolygonArea(path.points);
          return area >= minArea;
        });

        if (filteredPaths.length > 0) {
          layers.push({
            id: `layer-${colorIndex}`,
            name: `Color ${colorIndex + 1}`,
            color: rgbToHex(color),
            paths: filteredPaths,
          });
        }
      } catch (error) {
        console.error(`Error tracing color layer ${colorIndex}:`, error);
      }
    }

    return layers;
  }

  /**
   * Process image in line art mode
   */
  private async processLineart(
    image: Jimp,
    settings: VectorizationSettings
  ): Promise<Layer[]> {
    const width = image.getWidth();
    const height = image.getHeight();

    // Convert to grayscale
    const processed = image.clone().grayscale();

    // Apply edge detection (Sobel-like)
    const edgeImage = new Jimp(width, height, 0xffffffff);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        // Sobel kernels
        const getGray = (px: number, py: number): number => {
          const idx = (py * width + px) * 4;
          return processed.bitmap.data[idx];
        };

        // Horizontal gradient
        const gx =
          -getGray(x - 1, y - 1) - 2 * getGray(x - 1, y) - getGray(x - 1, y + 1) +
          getGray(x + 1, y - 1) + 2 * getGray(x + 1, y) + getGray(x + 1, y + 1);

        // Vertical gradient
        const gy =
          -getGray(x - 1, y - 1) - 2 * getGray(x, y - 1) - getGray(x + 1, y - 1) +
          getGray(x - 1, y + 1) + 2 * getGray(x, y + 1) + getGray(x + 1, y + 1);

        // Gradient magnitude
        const magnitude = Math.sqrt(gx * gx + gy * gy);

        // Threshold based on detail setting
        const edgeThreshold = 50 + (100 - settings.detail) * 1.5;
        const value = magnitude > edgeThreshold ? 0 : 255;

        edgeImage.setPixelColor(
          Jimp.rgbaToInt(value, value, value, 255),
          x,
          y
        );
      }
    }

    // Trace edges
    const pngBuffer = await edgeImage.getBufferAsync(Jimp.MIME_PNG);
    const tolerance = this.detailToTolerance(settings.detail);

    const svgString = await potraceTrace(pngBuffer, {
      turdSize: Math.max(2, Math.floor((100 - settings.detail) / 5)),
      optTolerance: tolerance,
      threshold: 128,
    });

    const paths = this.parseSVGPaths(svgString , settings);

    return [{
      id: 'layer-0',
      name: 'Line Art',
      color: '#000000',
      paths,
    }];
  }

  /**
   * Convert detail slider value to potrace tolerance
   */
  private detailToTolerance(detail: number): number {
    // Detail 0 = high tolerance (fewer points), Detail 100 = low tolerance (more points)
    return 2 - (detail / 100) * 1.8;
  }

  /**
   * Parse SVG path elements from potrace output
   */
  private parseSVGPaths(svgString: string, settings: VectorizationSettings): PathData[] {
    const paths: PathData[] = [];

    // Extract path d attributes
    const pathRegex = /<path[^>]*d="([^"]*)"[^>]*>/g;
    let match;

    while ((match = pathRegex.exec(svgString)) !== null) {
      const d = match[1];
      const points = this.parsePathD(d);

      if (points.length > 2) {
        // Apply smoothing
        const smoothIterations = Math.floor(settings.smoothing / 25);
        let processedPoints = points;

        if (smoothIterations > 0) {
          processedPoints = smoothPath(points, smoothIterations);
        }

        // Apply simplification based on detail
        const tolerance = (100 - settings.detail) / 10;
        if (tolerance > 0) {
          processedPoints = simplifyPath(processedPoints, tolerance);
        }

        paths.push({
          points: processedPoints,
          closed: d.toUpperCase().includes('Z'),
          fill: '#000000',
        });
      }
    }

    return paths;
  }

  /**
   * Parse SVG path d attribute to points
   */
  private parsePathD(d: string): Point[] {
    const points: Point[] = [];
    let currentX = 0;
    let currentY = 0;

    // Tokenize path data
    const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];

    for (const cmd of commands) {
      const type = cmd[0];
      const args = cmd
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .filter(s => s)
        .map(Number);

      switch (type) {
        case 'M': // Absolute moveto
          currentX = args[0] || 0;
          currentY = args[1] || 0;
          points.push({ x: currentX, y: currentY });
          // Additional coordinate pairs are lineto
          for (let i = 2; i < args.length; i += 2) {
            currentX = args[i];
            currentY = args[i + 1];
            points.push({ x: currentX, y: currentY });
          }
          break;

        case 'm': // Relative moveto
          currentX += args[0] || 0;
          currentY += args[1] || 0;
          points.push({ x: currentX, y: currentY });
          for (let i = 2; i < args.length; i += 2) {
            currentX += args[i];
            currentY += args[i + 1];
            points.push({ x: currentX, y: currentY });
          }
          break;

        case 'L': // Absolute lineto
          for (let i = 0; i < args.length; i += 2) {
            currentX = args[i];
            currentY = args[i + 1];
            points.push({ x: currentX, y: currentY });
          }
          break;

        case 'l': // Relative lineto
          for (let i = 0; i < args.length; i += 2) {
            currentX += args[i];
            currentY += args[i + 1];
            points.push({ x: currentX, y: currentY });
          }
          break;

        case 'H': // Absolute horizontal lineto
          for (const arg of args) {
            currentX = arg;
            points.push({ x: currentX, y: currentY });
          }
          break;

        case 'h': // Relative horizontal lineto
          for (const arg of args) {
            currentX += arg;
            points.push({ x: currentX, y: currentY });
          }
          break;

        case 'V': // Absolute vertical lineto
          for (const arg of args) {
            currentY = arg;
            points.push({ x: currentX, y: currentY });
          }
          break;

        case 'v': // Relative vertical lineto
          for (const arg of args) {
            currentY += arg;
            points.push({ x: currentX, y: currentY });
          }
          break;

        case 'C': // Absolute cubic bezier
          for (let i = 0; i < args.length; i += 6) {
            // Sample points along the curve
            const x1 = args[i], y1 = args[i + 1];
            const x2 = args[i + 2], y2 = args[i + 3];
            const x = args[i + 4], y = args[i + 5];

            for (let t = 0.25; t <= 1; t += 0.25) {
              const pt = this.cubicBezierPoint(
                currentX, currentY, x1, y1, x2, y2, x, y, t
              );
              points.push(pt);
            }
            currentX = x;
            currentY = y;
          }
          break;

        case 'c': // Relative cubic bezier
          for (let i = 0; i < args.length; i += 6) {
            const x1 = currentX + args[i], y1 = currentY + args[i + 1];
            const x2 = currentX + args[i + 2], y2 = currentY + args[i + 3];
            const x = currentX + args[i + 4], y = currentY + args[i + 5];

            for (let t = 0.25; t <= 1; t += 0.25) {
              const pt = this.cubicBezierPoint(
                currentX, currentY, x1, y1, x2, y2, x, y, t
              );
              points.push(pt);
            }
            currentX = x;
            currentY = y;
          }
          break;

        case 'Z':
        case 'z':
          // Close path - don't need to add point
          break;
      }
    }

    return points;
  }

  /**
   * Calculate point on cubic bezier curve at parameter t
   */
  private cubicBezierPoint(
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    t: number
  ): Point {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x: mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3,
      y: mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3,
    };
  }

  /**
   * Generate final SVG output
   */
  private generateSVG(
    layers: Layer[],
    settings: VectorizationSettings,
    sourceWidth: number,
    sourceHeight: number
  ): string {
    // Calculate dimensions preserving aspect ratio
    const aspectRatio = sourceWidth / sourceHeight;
    let outputWidth = settings.targetWidth;
    let outputHeight = settings.targetHeight;

    // Adjust to maintain aspect ratio
    if (outputWidth / outputHeight > aspectRatio) {
      outputWidth = outputHeight * aspectRatio;
    } else {
      outputHeight = outputWidth / aspectRatio;
    }

    const unit = settings.unit;
    const viewBoxWidth = sourceWidth;
    const viewBoxHeight = sourceHeight;

    // Build SVG
    const svgParts: string[] = [];

    svgParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    svgParts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `width="${outputWidth.toFixed(4)}${unit}" ` +
      `height="${outputHeight.toFixed(4)}${unit}" ` +
      `viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">`
    );

    // Add layers as groups
    for (const layer of layers) {
      svgParts.push(`  <g id="${layer.id}" data-name="${layer.name}">`);

      for (const path of layer.paths) {
        const d = this.pointsToPathD(path.points, path.closed);

        if (path.stroke) {
          svgParts.push(
            `    <path d="${d}" fill="none" stroke="${layer.color}" ` +
            `stroke-width="${path.strokeWidth || 1}"/>`
          );
        } else {
          svgParts.push(`    <path d="${d}" fill="${layer.color}"/>`);
        }
      }

      svgParts.push(`  </g>`);
    }

    svgParts.push(`</svg>`);

    return svgParts.join('\n');
  }

  /**
   * Convert points to SVG path data
   */
  private pointsToPathD(points: Point[], closed: boolean): string {
    if (points.length === 0) return '';

    const parts: string[] = [];
    parts.push(`M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`);

    for (let i = 1; i < points.length; i++) {
      parts.push(`L${points[i].x.toFixed(2)},${points[i].y.toFixed(2)}`);
    }

    if (closed) {
      parts.push('Z');
    }

    return parts.join('');
  }
}

export const vectorizer = new Vectorizer();
