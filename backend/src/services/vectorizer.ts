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

/**
 * Apply cleanup options to a binary (black/white) image buffer
 * Returns processed buffer with cleanup applied
 */
async function applyCleanupOptions(
  imageBuffer: Buffer,
  settings: VectorizationSettings,
  width: number,
  height: number
): Promise<Buffer> {
  // Get raw pixel data
  const { data } = await sharp(imageBuffer)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Convert to mutable array
  let pixels = new Uint8Array(data.buffer, data.byteOffset, data.length);

  // Apply threshold first to get binary image
  const threshold = settings.threshold ?? 128;
  const binaryPixels = new Uint8Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) {
    binaryPixels[i] = pixels[i] < threshold ? 0 : 255;
  }
  pixels = binaryPixels;

  // Apply invert if requested (swap black and white)
  if (settings.invert) {
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = pixels[i] === 0 ? 255 : 0;
    }
  }

  // Apply erosion if requested (shrinks black regions)
  if (settings.erosionLevel > 0) {
    pixels = applyErosion(pixels, width, height, settings.erosionLevel);
  }

  // Remove edge-connected regions if requested
  if (settings.removeEdgeRegions) {
    pixels = removeEdgeConnectedRegions(pixels, width, height);
  }

  // Remove small regions based on minRegionSize
  if (settings.minRegionSize > 0) {
    pixels = removeSmallRegions(pixels, width, height, settings.minRegionSize);
  }

  // Convert back to PNG buffer
  return sharp(Buffer.from(pixels.buffer), {
    raw: { width, height, channels: 1 }
  }).png().toBuffer();
}

/**
 * Apply morphological erosion to shrink black regions
 * This removes thin connecting areas between regions
 */
function applyErosion(pixels: Uint8Array, width: number, height: number, iterations: number): Uint8Array {
  let current = new Uint8Array(pixels);

  for (let iter = 0; iter < iterations; iter++) {
    const next = new Uint8Array(current.length);
    next.fill(255); // Start with white

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        // Only keep black pixel if ALL neighbors are also black (3x3 kernel)
        let allBlack = true;
        for (let dy = -1; dy <= 1 && allBlack; dy++) {
          for (let dx = -1; dx <= 1 && allBlack; dx++) {
            const nIdx = (y + dy) * width + (x + dx);
            if (current[nIdx] !== 0) {
              allBlack = false;
            }
          }
        }

        if (allBlack) {
          next[idx] = 0;
        }
      }
    }

    current = next;
  }

  return current;
}

/**
 * Remove black regions that are connected to the image border
 * Uses flood fill from all edge pixels
 */
function removeEdgeConnectedRegions(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(pixels);

  // Track visited pixels
  const visited = new Uint8Array(pixels.length);

  // Flood fill function
  const floodFill = (startX: number, startY: number) => {
    const stack: [number, number][] = [[startX, startY]];

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[idx]) continue;
      if (result[idx] !== 0) continue; // Only fill black pixels

      visited[idx] = 1;
      result[idx] = 255; // Change to white

      // Add neighbors (4-connected)
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  };

  // Start flood fill from all edge pixels that are black
  // Top and bottom edges
  for (let x = 0; x < width; x++) {
    if (result[x] === 0) floodFill(x, 0);
    if (result[(height - 1) * width + x] === 0) floodFill(x, height - 1);
  }

  // Left and right edges
  for (let y = 0; y < height; y++) {
    if (result[y * width] === 0) floodFill(0, y);
    if (result[y * width + width - 1] === 0) floodFill(width - 1, y);
  }

  return result;
}

/**
 * Remove small isolated regions below a certain size threshold
 * Uses connected component labeling
 */
function removeSmallRegions(pixels: Uint8Array, width: number, height: number, minSizePercent: number): Uint8Array {
  const result = new Uint8Array(pixels);
  const totalPixels = width * height;
  const minPixels = Math.floor(totalPixels * minSizePercent / 100);

  // Label connected components
  const labels = new Int32Array(pixels.length);
  let currentLabel = 0;
  const labelSizes = new Map<number, number>();

  const floodFillLabel = (startX: number, startY: number, label: number): number => {
    const stack: [number, number][] = [[startX, startY]];
    let size = 0;

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (labels[idx] !== 0) continue;
      if (result[idx] !== 0) continue; // Only label black pixels

      labels[idx] = label;
      size++;

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    return size;
  };

  // Find and label all black regions
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (result[idx] === 0 && labels[idx] === 0) {
        currentLabel++;
        const size = floodFillLabel(x, y, currentLabel);
        labelSizes.set(currentLabel, size);
      }
    }
  }

  // Remove regions smaller than threshold
  for (let i = 0; i < result.length; i++) {
    if (labels[i] !== 0) {
      const size = labelSizes.get(labels[i]) || 0;
      if (size < minPixels) {
        result[i] = 255; // Change to white
      }
    }
  }

  return result;
}

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
    // Check if any cleanup options are enabled
    const hasCleanupOptions = settings.invert ||
                              settings.erosionLevel > 0 ||
                              settings.removeEdgeRegions ||
                              settings.minRegionSize > 0;

    let processedBuffer: Buffer;

    if (hasCleanupOptions) {
      // Apply cleanup options (includes threshold, invert, erosion, edge removal, small region removal)
      processedBuffer = await applyCleanupOptions(imageBuffer, settings, width, height);
    } else {
      // Simple grayscale conversion
      processedBuffer = await sharp(imageBuffer)
        .grayscale()
        .png()
        .toBuffer();
    }

    // Trace with potrace
    // If we already applied cleanup, use threshold 128 since image is already binary
    const threshold = hasCleanupOptions ? 128 : (settings.threshold ?? 128);
    const svgString = await potraceTrace(processedBuffer, {
      turdSize: Math.max(2, Math.floor((100 - settings.detail) / 10)),
      optTolerance: this.detailToTolerance(settings.detail),
      threshold: threshold,
      blackOnWhite: true,
    });

    // Extract paths and viewBox from potrace output
    const { paths, viewBox } = this.extractPathsAndViewBox(svgString);

    // Use potrace's viewBox if available, otherwise fall back to image dimensions
    const vbWidth = viewBox.width || width;
    const vbHeight = viewBox.height || height;

    const svg = this.buildSVG(paths, settings, vbWidth, vbHeight, '#000000', 'Silhouette');

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
    let finalViewBox = { width: width, height: height };

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

        const { paths, viewBox } = this.extractPathsAndViewBox(svgString);

        // Use first valid viewBox for all layers
        if (viewBox.width && viewBox.height && finalViewBox.width === width) {
          finalViewBox = viewBox;
        }

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

    // Build combined SVG with all layers using the extracted viewBox
    const svg = this.buildMultiLayerSVG(allLayerPaths, settings, finalViewBox.width, finalViewBox.height);

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

    // Extract paths and viewBox from potrace output
    const { paths, viewBox } = this.extractPathsAndViewBox(svgString);

    // Use potrace's viewBox if available, otherwise fall back to image dimensions
    const vbWidth = viewBox.width || width;
    const vbHeight = viewBox.height || height;

    const svg = this.buildSVG(paths, settings, vbWidth, vbHeight, '#000000', 'Line Art');

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
   * Extract path d attributes and viewBox from potrace SVG output
   */
  private extractPathsAndViewBox(svgString: string): { paths: string[]; viewBox: { width: number; height: number } } {
    const paths: string[] = [];

    // Extract viewBox or width/height from potrace SVG
    let viewBoxWidth = 0;
    let viewBoxHeight = 0;

    // Try to match viewBox attribute
    const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].split(/\s+/).map(Number);
      if (parts.length >= 4) {
        viewBoxWidth = parts[2];
        viewBoxHeight = parts[3];
      }
    }

    // Fallback to width/height attributes if no viewBox
    if (!viewBoxWidth || !viewBoxHeight) {
      const widthMatch = svgString.match(/width="(\d+(?:\.\d+)?)(?:pt)?"/);
      const heightMatch = svgString.match(/height="(\d+(?:\.\d+)?)(?:pt)?"/);
      if (widthMatch) viewBoxWidth = parseFloat(widthMatch[1]);
      if (heightMatch) viewBoxHeight = parseFloat(heightMatch[1]);
    }

    // Match path elements and extract d attribute
    const pathRegex = /<path[^>]*\sd="([^"]+)"[^>]*\/?>/g;
    let match;

    while ((match = pathRegex.exec(svgString)) !== null) {
      const d = match[1];
      if (d && d.trim()) {
        paths.push(d);
      }
    }

    return { paths, viewBox: { width: viewBoxWidth, height: viewBoxHeight } };
  }

  /**
   * Build final SVG with proper dimensions and structure
   */
  private buildSVG(
    paths: string[],
    settings: VectorizationSettings,
    viewBoxWidth: number,
    viewBoxHeight: number,
    fillColor: string,
    layerName: string = 'Silhouette'
  ): string {
    const { outputWidth, outputHeight } = this.calculateOutputDimensions(
      viewBoxWidth, viewBoxHeight, settings
    );

    const unit = settings.unit;
    const lines: string[] = [];

    lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth.toFixed(4)}${unit}" height="${outputHeight.toFixed(4)}${unit}" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">`);
    lines.push(`  <g id="layer-0" data-name="${layerName}">`);

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
    viewBoxWidth: number,
    viewBoxHeight: number
  ): string {
    const { outputWidth, outputHeight } = this.calculateOutputDimensions(
      viewBoxWidth, viewBoxHeight, settings
    );

    const unit = settings.unit;
    const lines: string[] = [];

    lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth.toFixed(4)}${unit}" height="${outputHeight.toFixed(4)}${unit}" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">`);

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
