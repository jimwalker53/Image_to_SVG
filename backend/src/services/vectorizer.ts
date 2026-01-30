import sharp from 'sharp';
import potrace, { type PotraceOptions } from 'potrace';
import type {
  VectorizationSettings,
  ConversionResult,
  LayerInfo,
} from '../types/index.js';
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

export class Vectorizer {
  /**
   * Main conversion entry point
   */
  async convert(
    imageBuffer: Buffer,
    settings: VectorizationSettings
  ): Promise<ConversionResult> {
    const startTime = Date.now();

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width || 800;
    const originalHeight = metadata.height || 600;

    // Resize if needed, keeping aspect ratio
    let processedBuffer = imageBuffer;
    let width = originalWidth;
    let height = originalHeight;

    if (originalWidth > MAX_DIMENSION || originalHeight > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(originalWidth, originalHeight);
      width = Math.round(originalWidth * scale);
      height = Math.round(originalHeight * scale);
      processedBuffer = await sharp(imageBuffer)
        .resize(width, height, { fit: 'inside' })
        .toBuffer();
    }

    let svg: string;
    let layers: LayerInfo[];

    switch (settings.mode) {
      case 'silhouette':
        ({ svg, layers } = await this.processSilhouette(processedBuffer, settings, width, height));
        break;
      case 'multicolor':
        ({ svg, layers } = await this.processMulticolor(processedBuffer, settings, width, height));
        break;
      case 'lineart':
        ({ svg, layers } = await this.processLineart(processedBuffer, settings, width, height));
        break;
      default:
        throw new Error(`Unknown conversion mode: ${settings.mode}`);
    }

    // Count paths and points for stats
    const pathMatches = svg.match(/<path/g) || [];
    const dMatches = svg.match(/d="([^"]*)"/g) || [];
    let totalPoints = 0;
    for (const d of dMatches) {
      // Rough estimate: count command letters
      const commands = d.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || [];
      totalPoints += commands.length;
    }

    const stats = {
      totalPaths: pathMatches.length,
      totalPoints,
      processingTimeMs: Date.now() - startTime,
      originalWidth,
      originalHeight,
      outputWidth: settings.targetWidth,
      outputHeight: settings.targetHeight,
    };

    return { svg, layers, stats };
  }

  /**
   * Process image in silhouette (single color) mode
   */
  private async processSilhouette(
    imageBuffer: Buffer,
    settings: VectorizationSettings,
    width: number,
    height: number
  ): Promise<{ svg: string; layers: LayerInfo[] }> {
    // Convert to grayscale
    const grayscaleBuffer = await sharp(imageBuffer)
      .grayscale()
      .png()
      .toBuffer();

    // Trace with potrace
    const threshold = settings.threshold ?? 128;
    const svgString = await potraceTrace(grayscaleBuffer, {
      turdSize: Math.max(2, Math.floor((100 - settings.detail) / 10)),
      optTolerance: this.detailToTolerance(settings.detail),
      threshold: threshold,
      blackOnWhite: true,
    });

    // Extract paths from potrace output and build our SVG
    const paths = this.extractPaths(svgString);
    const svg = this.buildSVG(paths, settings, width, height, '#000000');

    const layers: LayerInfo[] = [{
      id: 'layer-0',
      name: 'Silhouette',
      color: '#000000',
      pathCount: paths.length,
      pointCount: this.countPathPoints(paths),
    }];

    return { svg, layers };
  }

  /**
   * Process image in multi-color mode
   */
  private async processMulticolor(
    imageBuffer: Buffer,
    settings: VectorizationSettings,
    width: number,
    height: number
  ): Promise<{ svg: string; layers: LayerInfo[] }> {
    // Get raw pixel data
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels: RGBA[] = [];
    for (let i = 0; i < data.length; i += 4) {
      pixels.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
        a: data[i + 3],
      });
    }

    // Handle background removal
    if (settings.background === 'remove') {
      const bgColor = findBackgroundColor(pixels, info.width, info.height);
      if (bgColor) {
        pixels.forEach((pixel, i) => {
          if (colorDistance(pixel, bgColor) < 30) {
            pixels[i].a = 0;
          }
        });
      }
    }

    // Quantize colors
    const { palette, assignments } = kMeansQuantize(pixels, settings.colorLayers);
    const sortedPalette = sortColorsByLuminance(palette);

    // Map old indices to new sorted indices
    const paletteMap = new Map<number, number>();
    palette.forEach((color, oldIndex) => {
      const newIndex = sortedPalette.findIndex(
        c => c.r === color.r && c.g === color.g && c.b === color.b
      );
      paletteMap.set(oldIndex, newIndex);
    });

    // Process each color layer
    const allLayerPaths: { paths: string[]; color: string; name: string }[] = [];

    for (let colorIndex = 0; colorIndex < sortedPalette.length; colorIndex++) {
      const color = sortedPalette[colorIndex];

      // Create binary image for this color
      const binaryData = Buffer.alloc(info.width * info.height);

      assignments.forEach((assignment, i) => {
        if (assignment === -1) {
          binaryData[i] = 255; // Transparent -> white
          return;
        }
        const mappedAssignment = paletteMap.get(assignment);
        binaryData[i] = mappedAssignment === colorIndex ? 0 : 255;
      });

      // Create PNG from binary data
      const binaryPng = await sharp(binaryData, {
        raw: { width: info.width, height: info.height, channels: 1 }
      }).png().toBuffer();

      // Trace this color
      try {
        const svgString = await potraceTrace(binaryPng, {
          turdSize: Math.max(2, Math.floor((100 - settings.detail) / 10)),
          optTolerance: this.detailToTolerance(settings.detail),
          threshold: 128,
          blackOnWhite: true,
        });

        const paths = this.extractPaths(svgString);

        if (paths.length > 0) {
          allLayerPaths.push({
            paths,
            color: rgbToHex(color),
            name: `Color ${colorIndex + 1}`,
          });
        }
      } catch (error) {
        console.error(`Error tracing color layer ${colorIndex}:`, error);
      }
    }

    // Build combined SVG with all layers
    const svg = this.buildMultiLayerSVG(allLayerPaths, settings, width, height);

    const layers: LayerInfo[] = allLayerPaths.map((layer, index) => ({
      id: `layer-${index}`,
      name: layer.name,
      color: layer.color,
      pathCount: layer.paths.length,
      pointCount: this.countPathPoints(layer.paths),
    }));

    return { svg, layers };
  }

  /**
   * Process image in line art mode
   */
  private async processLineart(
    imageBuffer: Buffer,
    settings: VectorizationSettings,
    width: number,
    height: number
  ): Promise<{ svg: string; layers: LayerInfo[] }> {
    // Use sharp's edge detection via convolution (Sobel-like)
    // First convert to grayscale, then use Canny-style edge detection
    const edgeBuffer = await sharp(imageBuffer)
      .grayscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1], // Laplacian edge detection
      })
      .negate() // Invert so edges are black on white
      .normalize() // Enhance contrast
      .png()
      .toBuffer();

    // Trace edges
    const svgString = await potraceTrace(edgeBuffer, {
      turdSize: Math.max(2, Math.floor((100 - settings.detail) / 5)),
      optTolerance: this.detailToTolerance(settings.detail),
      threshold: 128 + Math.floor((50 - settings.detail / 2)),
      blackOnWhite: true,
    });

    const paths = this.extractPaths(svgString);
    const svg = this.buildSVG(paths, settings, width, height, '#000000');

    const layers: LayerInfo[] = [{
      id: 'layer-0',
      name: 'Line Art',
      color: '#000000',
      pathCount: paths.length,
      pointCount: this.countPathPoints(paths),
    }];

    return { svg, layers };
  }

  /**
   * Extract path d attributes from potrace SVG output
   */
  private extractPaths(svgString: string): string[] {
    const paths: string[] = [];

    // Match path elements and extract d attribute
    const pathRegex = /<path[^>]*\sd="([^"]+)"[^>]*\/?>/g;
    let match;

    while ((match = pathRegex.exec(svgString)) !== null) {
      const d = match[1];
      if (d && d.trim()) {
        paths.push(d);
      }
    }

    return paths;
  }

  /**
   * Build final SVG with proper dimensions and structure
   */
  private buildSVG(
    paths: string[],
    settings: VectorizationSettings,
    sourceWidth: number,
    sourceHeight: number,
    fillColor: string
  ): string {
    const { outputWidth, outputHeight } = this.calculateOutputDimensions(
      sourceWidth, sourceHeight, settings
    );

    const unit = settings.unit;
    const lines: string[] = [];

    lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth.toFixed(4)}${unit}" height="${outputHeight.toFixed(4)}${unit}" viewBox="0 0 ${sourceWidth} ${sourceHeight}">`);
    lines.push(`  <g id="layer-0" data-name="Silhouette">`);

    for (const pathD of paths) {
      lines.push(`    <path d="${pathD}" fill="${fillColor}"/>`);
    }

    lines.push(`  </g>`);
    lines.push(`</svg>`);

    return lines.join('\n');
  }

  /**
   * Build multi-layer SVG
   */
  private buildMultiLayerSVG(
    layerData: { paths: string[]; color: string; name: string }[],
    settings: VectorizationSettings,
    sourceWidth: number,
    sourceHeight: number
  ): string {
    const { outputWidth, outputHeight } = this.calculateOutputDimensions(
      sourceWidth, sourceHeight, settings
    );

    const unit = settings.unit;
    const lines: string[] = [];

    lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth.toFixed(4)}${unit}" height="${outputHeight.toFixed(4)}${unit}" viewBox="0 0 ${sourceWidth} ${sourceHeight}">`);

    layerData.forEach((layer, index) => {
      lines.push(`  <g id="layer-${index}" data-name="${layer.name}">`);
      for (const pathD of layer.paths) {
        lines.push(`    <path d="${pathD}" fill="${layer.color}"/>`);
      }
      lines.push(`  </g>`);
    });

    lines.push(`</svg>`);

    return lines.join('\n');
  }

  /**
   * Calculate output dimensions maintaining aspect ratio
   */
  private calculateOutputDimensions(
    sourceWidth: number,
    sourceHeight: number,
    settings: VectorizationSettings
  ): { outputWidth: number; outputHeight: number } {
    const aspectRatio = sourceWidth / sourceHeight;
    let outputWidth = settings.targetWidth;
    let outputHeight = settings.targetHeight;

    // Adjust to maintain aspect ratio
    if (outputWidth / outputHeight > aspectRatio) {
      outputWidth = outputHeight * aspectRatio;
    } else {
      outputHeight = outputWidth / aspectRatio;
    }

    return { outputWidth, outputHeight };
  }

  /**
   * Convert detail slider value to potrace tolerance
   */
  private detailToTolerance(detail: number): number {
    // Detail 0 = high tolerance (fewer points), Detail 100 = low tolerance (more points)
    return 2 - (detail / 100) * 1.8;
  }

  /**
   * Count approximate points in path strings
   */
  private countPathPoints(paths: string[]): number {
    let count = 0;
    for (const path of paths) {
      // Count path commands as approximate point count
      const commands = path.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || [];
      count += commands.length;
    }
    return count;
  }
}

export const vectorizer = new Vectorizer();
