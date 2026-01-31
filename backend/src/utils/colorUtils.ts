/**
 * Color utilities for image processing and color quantization
 * Includes LAB color space support for perceptually accurate color comparison
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA extends RGB {
  a: number;
}

export interface LAB {
  L: number;
  a: number;
  b: number;
}

/**
 * Convert RGB to hex color string
 */
export function rgbToHex(color: RGB): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

/**
 * Convert hex color string to RGB
 */
export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to LAB color space
 * LAB is perceptually uniform - equal distances represent equal perceived differences
 */
export function rgbToLab(color: RGB): LAB {
  // First convert RGB to XYZ
  let r = color.r / 255;
  let g = color.g / 255;
  let b = color.b / 255;

  // Apply gamma correction (sRGB)
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Convert to XYZ using D65 illuminant
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / 1.00000;
  const z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;

  // Convert XYZ to LAB
  const f = (t: number) => t > 0.008856 ? Math.pow(t, 1/3) : (7.787 * t) + 16/116;

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    L: (116 * fy) - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * Calculate perceptual color distance using LAB color space (Delta E)
 * More accurate than RGB Euclidean distance for human perception
 */
export function colorDistanceLab(c1: RGB, c2: RGB): number {
  const lab1 = rgbToLab(c1);
  const lab2 = rgbToLab(c2);

  return Math.sqrt(
    Math.pow(lab1.L - lab2.L, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

/**
 * Calculate Euclidean distance between two colors in RGB space
 * Faster but less perceptually accurate than LAB
 */
export function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * Weighted RGB color distance (compromise between speed and accuracy)
 * Weights based on human eye sensitivity to different colors
 */
export function colorDistanceWeighted(c1: RGB, c2: RGB): number {
  const rmean = (c1.r + c2.r) / 2;
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;

  // Redmean color difference formula
  const weightR = 2 + rmean / 256;
  const weightG = 4;
  const weightB = 2 + (255 - rmean) / 256;

  return Math.sqrt(weightR * dr * dr + weightG * dg * dg + weightB * db * db);
}

/**
 * Calculate luminance of a color (0-255)
 */
export function getLuminance(color: RGB): number {
  return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

/**
 * K-means color quantization with LAB color space
 * Reduces an image's colors to k representative colors
 * Uses pixel sampling for large images to improve performance
 */
export function kMeansQuantize(
  pixels: RGBA[],
  k: number,
  maxIterations: number = 20,
  useLab: boolean = true
): { palette: RGB[]; assignments: number[] } {
  // Filter out fully transparent pixels
  const opaquePixels = pixels.filter(p => p.a > 128);

  if (opaquePixels.length === 0) {
    return {
      palette: [{ r: 255, g: 255, b: 255 }],
      assignments: pixels.map(() => 0),
    };
  }

  // Sample pixels for large images to improve performance
  const MAX_SAMPLE_SIZE = 50000;
  let samplePixels = opaquePixels;
  if (opaquePixels.length > MAX_SAMPLE_SIZE) {
    const step = Math.ceil(opaquePixels.length / MAX_SAMPLE_SIZE);
    samplePixels = opaquePixels.filter((_, i) => i % step === 0);
  }

  // Pre-compute LAB values if using LAB color space
  const labCache = new Map<number, LAB>();
  const getLabCached = (pixel: RGB): LAB => {
    const key = (pixel.r << 16) | (pixel.g << 8) | pixel.b;
    let lab = labCache.get(key);
    if (!lab) {
      lab = rgbToLab(pixel);
      labCache.set(key, lab);
    }
    return lab;
  };

  // Distance function based on color space choice
  const distanceFn = useLab
    ? (c1: RGB, c2: RGB) => {
        const lab1 = getLabCached(c1);
        const lab2 = getLabCached(c2);
        return Math.sqrt(
          Math.pow(lab1.L - lab2.L, 2) +
          Math.pow(lab1.a - lab2.a, 2) +
          Math.pow(lab1.b - lab2.b, 2)
        );
      }
    : colorDistanceWeighted;

  // Initialize centroids using k-means++ initialization
  const centroids: RGB[] = initializeCentroids(samplePixels, k, distanceFn);
  let assignments: number[] = new Array(samplePixels.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each pixel to nearest centroid
    const newAssignments = samplePixels.map(pixel => {
      let minDist = Infinity;
      let minIndex = 0;
      for (let i = 0; i < centroids.length; i++) {
        const dist = distanceFn(pixel, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          minIndex = i;
        }
      }
      return minIndex;
    });

    // Check for convergence
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;

    if (!changed) break;

    // Update centroids
    const sums: { r: number; g: number; b: number; count: number }[] =
      Array.from({ length: k }, () => ({ r: 0, g: 0, b: 0, count: 0 }));

    samplePixels.forEach((pixel, i) => {
      const cluster = assignments[i];
      sums[cluster].r += pixel.r;
      sums[cluster].g += pixel.g;
      sums[cluster].b += pixel.b;
      sums[cluster].count++;
    });

    sums.forEach((sum, i) => {
      if (sum.count > 0) {
        centroids[i] = {
          r: Math.round(sum.r / sum.count),
          g: Math.round(sum.g / sum.count),
          b: Math.round(sum.b / sum.count),
        };
      }
    });
  }

  // Map assignments back to original pixel array (including transparent)
  const fullAssignments = pixels.map(pixel => {
    if (pixel.a <= 128) return -1; // Transparent
    let minDist = Infinity;
    let minIndex = 0;
    for (let i = 0; i < centroids.length; i++) {
      const dist = distanceFn(pixel, centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        minIndex = i;
      }
    }
    return minIndex;
  });

  return { palette: centroids, assignments: fullAssignments };
}

/**
 * K-means++ initialization for better starting centroids
 */
function initializeCentroids(
  pixels: RGB[],
  k: number,
  distanceFn: (c1: RGB, c2: RGB) => number
): RGB[] {
  const centroids: RGB[] = [];

  // Choose first centroid randomly
  const firstIndex = Math.floor(Math.random() * pixels.length);
  centroids.push({ ...pixels[firstIndex] });

  // Choose remaining centroids with probability proportional to distance squared
  for (let i = 1; i < k; i++) {
    const distances = pixels.map(pixel => {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = distanceFn(pixel, centroid);
        minDist = Math.min(minDist, dist);
      }
      return minDist * minDist; // Square for probability weighting
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    let target = Math.random() * totalDist;

    for (let j = 0; j < pixels.length; j++) {
      target -= distances[j];
      if (target <= 0) {
        centroids.push({ ...pixels[j] });
        break;
      }
    }

    // Fallback in case of numerical issues
    if (centroids.length === i) {
      centroids.push({ ...pixels[Math.floor(Math.random() * pixels.length)] });
    }
  }

  return centroids;
}

/**
 * Median cut color quantization (alternative to k-means)
 * Faster but may produce less optimal palettes
 */
export function medianCutQuantize(
  pixels: RGBA[],
  targetColors: number
): { palette: RGB[]; assignments: number[] } {
  // Filter out transparent pixels
  const opaquePixels = pixels.filter(p => p.a > 128);

  if (opaquePixels.length === 0) {
    return {
      palette: [{ r: 255, g: 255, b: 255 }],
      assignments: pixels.map(() => 0),
    };
  }

  // Start with all pixels in one bucket
  interface Bucket {
    pixels: RGB[];
  }

  let buckets: Bucket[] = [{ pixels: opaquePixels.map(p => ({ r: p.r, g: p.g, b: p.b })) }];

  // Split buckets until we have enough colors
  while (buckets.length < targetColors) {
    // Find bucket with largest range
    let maxRange = 0;
    let maxBucketIndex = 0;
    let splitChannel: 'r' | 'g' | 'b' = 'r';

    buckets.forEach((bucket, index) => {
      if (bucket.pixels.length < 2) return;

      for (const channel of ['r', 'g', 'b'] as const) {
        const values = bucket.pixels.map(p => p[channel]);
        const range = Math.max(...values) - Math.min(...values);
        if (range > maxRange) {
          maxRange = range;
          maxBucketIndex = index;
          splitChannel = channel;
        }
      }
    });

    if (maxRange === 0) break;

    // Split the bucket
    const bucket = buckets[maxBucketIndex];
    bucket.pixels.sort((a, b) => a[splitChannel] - b[splitChannel]);
    const midIndex = Math.floor(bucket.pixels.length / 2);

    buckets.splice(maxBucketIndex, 1,
      { pixels: bucket.pixels.slice(0, midIndex) },
      { pixels: bucket.pixels.slice(midIndex) }
    );
  }

  // Calculate palette from bucket averages
  const palette = buckets.map(bucket => {
    if (bucket.pixels.length === 0) {
      return { r: 128, g: 128, b: 128 };
    }
    const sum = bucket.pixels.reduce(
      (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
      { r: 0, g: 0, b: 0 }
    );
    return {
      r: Math.round(sum.r / bucket.pixels.length),
      g: Math.round(sum.g / bucket.pixels.length),
      b: Math.round(sum.b / bucket.pixels.length),
    };
  });

  // Assign each original pixel to nearest palette color
  const assignments = pixels.map(pixel => {
    if (pixel.a <= 128) return -1;
    let minDist = Infinity;
    let minIndex = 0;
    for (let i = 0; i < palette.length; i++) {
      const dist = colorDistanceWeighted(pixel, palette[i]);
      if (dist < minDist) {
        minDist = dist;
        minIndex = i;
      }
    }
    return minIndex;
  });

  return { palette, assignments };
}

/**
 * Sort colors by luminance (dark to light)
 */
export function sortColorsByLuminance(colors: RGB[]): RGB[] {
  return [...colors].sort((a, b) => getLuminance(a) - getLuminance(b));
}

/**
 * Find dominant background color (most common edge color)
 * Uses clustering to handle gradients and anti-aliasing
 */
export function findBackgroundColor(
  pixels: RGBA[],
  width: number,
  height: number
): RGB | null {
  const edgePixels: RGB[] = [];

  // Sample edge pixels
  for (let x = 0; x < width; x++) {
    // Top edge
    const topIdx = x;
    if (pixels[topIdx].a > 128) {
      edgePixels.push(pixels[topIdx]);
    }
    // Bottom edge
    const bottomIdx = (height - 1) * width + x;
    if (pixels[bottomIdx].a > 128) {
      edgePixels.push(pixels[bottomIdx]);
    }
  }

  for (let y = 0; y < height; y++) {
    // Left edge
    const leftIdx = y * width;
    if (pixels[leftIdx].a > 128) {
      edgePixels.push(pixels[leftIdx]);
    }
    // Right edge
    const rightIdx = y * width + (width - 1);
    if (pixels[rightIdx].a > 128) {
      edgePixels.push(pixels[rightIdx]);
    }
  }

  if (edgePixels.length === 0) return null;

  // Use weighted average for better handling of slight color variations
  const sum = edgePixels.reduce(
    (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
    { r: 0, g: 0, b: 0 }
  );

  return {
    r: Math.round(sum.r / edgePixels.length),
    g: Math.round(sum.g / edgePixels.length),
    b: Math.round(sum.b / edgePixels.length),
  };
}
