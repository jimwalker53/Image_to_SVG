import type { Point, PathData } from '../types/index.js';

/**
 * Douglas-Peucker path simplification algorithm
 * Reduces the number of points in a path while preserving shape
 */
export function simplifyPath(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance from the line between first and last
  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDist > tolerance) {
    const leftPoints = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const rightPoints = simplifyPath(points.slice(maxIndex), tolerance);
    return [...leftPoints.slice(0, -1), ...rightPoints];
  }

  return [first, last];
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) +
      Math.pow(point.y - lineStart.y, 2)
    );
  }

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);

  let nearestX: number, nearestY: number;

  if (t < 0) {
    nearestX = lineStart.x;
    nearestY = lineStart.y;
  } else if (t > 1) {
    nearestX = lineEnd.x;
    nearestY = lineEnd.y;
  } else {
    nearestX = lineStart.x + t * dx;
    nearestY = lineStart.y + t * dy;
  }

  return Math.sqrt(
    Math.pow(point.x - nearestX, 2) +
    Math.pow(point.y - nearestY, 2)
  );
}

/**
 * Smooth a path using Chaikin's corner cutting algorithm
 */
export function smoothPath(points: Point[], iterations: number): Point[] {
  if (points.length <= 2 || iterations <= 0) return points;

  let smoothed = [...points];

  for (let iter = 0; iter < iterations; iter++) {
    const newPoints: Point[] = [];

    for (let i = 0; i < smoothed.length - 1; i++) {
      const p0 = smoothed[i];
      const p1 = smoothed[i + 1];

      // Add points at 25% and 75% along each segment
      newPoints.push({
        x: p0.x * 0.75 + p1.x * 0.25,
        y: p0.y * 0.75 + p1.y * 0.25,
      });
      newPoints.push({
        x: p0.x * 0.25 + p1.x * 0.75,
        y: p0.y * 0.25 + p1.y * 0.75,
      });
    }

    // Keep endpoints
    if (smoothed.length > 0) {
      newPoints.unshift(smoothed[0]);
      newPoints.push(smoothed[smoothed.length - 1]);
    }

    smoothed = newPoints;
  }

  return smoothed;
}

/**
 * Convert points to SVG path data string
 */
export function pointsToPathD(points: Point[], closed: boolean): string {
  if (points.length === 0) return '';

  const parts: string[] = [];

  // Move to first point
  parts.push(`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`);

  // Line to subsequent points
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`);
  }

  if (closed) {
    parts.push('Z');
  }

  return parts.join(' ');
}

/**
 * Convert points to smooth bezier curve path data
 */
export function pointsToBezierD(points: Point[], closed: boolean): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  const parts: string[] = [];
  parts.push(`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`);

  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];

    // Calculate control points for smooth curve
    const midX1 = (p0.x + p1.x) / 2;
    const midY1 = (p0.y + p1.y) / 2;
    const midX2 = (p1.x + p2.x) / 2;
    const midY2 = (p1.y + p2.y) / 2;

    parts.push(`Q ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} ${midX2.toFixed(2)} ${midY2.toFixed(2)}`);
  }

  // Last point
  const last = points[points.length - 1];
  parts.push(`L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`);

  if (closed) {
    parts.push('Z');
  }

  return parts.join(' ');
}

/**
 * Calculate the area of a polygon
 */
export function calculatePolygonArea(points: Point[]): number {
  if (points.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area / 2);
}

/**
 * Count total points in all paths
 */
export function countPoints(paths: PathData[]): number {
  return paths.reduce((sum, path) => sum + path.points.length, 0);
}
