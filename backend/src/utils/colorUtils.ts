/**
 * Color utilities for image processing and color quantization
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA extends RGB {
  a: number;
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
 * Calculate Euclidean distance between two colors in RGB space
 */
export function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * Calculate luminance of a color (0-255)
 */
export function getLuminance(color: RGB): number {
  return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

/**
 * K-means color quantization
 * Reduces an image's colors to k representative colors
 */
export function kMeansQuantize(
  pixels: RGBA[],
  k: number,
  maxIterations: number = 20
): { palette: RGB[]; assignments: number[] } {
  // Filter out fully transparent pixels
  const opaquePixels = pixels.filter(p => p.a > 128);

  if (opaquePixels.length === 0) {
    return {
      palette: [{ r: 255, g: 255, b: 255 }],
      assignments: pixels.map(() => 0),
    };
  }

  // Initialize centroids using k-means++ initialization
  const centroids: RGB[] = initializeCentroids(opaquePixels, k);
  let assignments: number[] = new Array(opaquePixels.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each pixel to nearest centroid
    const newAssignments = opaquePixels.map(pixel => {
      let minDist = Infinity;
      let minIndex = 0;
      for (let i = 0; i < centroids.length; i++) {
        const dist = colorDistance(pixel, centroids[i]);
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

    opaquePixels.forEach((pixel, i) => {
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
      const dist = colorDistance(pixel, centroids[i]);
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
function initializeCentroids(pixels: RGB[], k: number): RGB[] {
  const centroids: RGB[] = [];

  // Choose first centroid randomly
  const firstIndex = Math.floor(Math.random() * pixels.length);
  centroids.push({ ...pixels[firstIndex] });

  // Choose remaining centroids
  for (let i = 1; i < k; i++) {
    const distances = pixels.map(pixel => {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = colorDistance(pixel, centroid);
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
      const dist = colorDistance(pixel, palette[i]);
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

  // Find average edge color
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
