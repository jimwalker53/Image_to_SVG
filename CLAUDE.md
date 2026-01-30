# Image to SVG - Cricut Design Tool

A browser-based tool that converts raster images (PNG/JPG) to SVG vector files compatible with Cricut Design Space.

## Project Structure

```
Image_to_SVG/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── index.ts        # Server entry point
│   │   ├── routes/
│   │   │   ├── convert.ts  # POST /api/convert endpoint
│   │   │   └── health.ts   # GET /api/health endpoint
│   │   ├── services/
│   │   │   └── vectorizer.ts  # Image vectorization pipeline
│   │   ├── types/
│   │   │   └── index.ts    # TypeScript type definitions
│   │   └── utils/
│   │       ├── colorUtils.ts   # Color quantization, k-means
│   │       └── pathUtils.ts    # Path simplification, smoothing
│   └── package.json
├── frontend/               # React + Vite + Tailwind
│   ├── src/
│   │   ├── App.tsx         # Main application component
│   │   ├── components/
│   │   │   ├── UploadComponent.tsx   # Image upload with drag-drop
│   │   │   ├── ControlsPanel.tsx     # Vectorization settings
│   │   │   ├── SVGPreview.tsx        # SVG preview with zoom/pan
│   │   │   ├── LayerList.tsx         # Layer visibility & ordering
│   │   │   └── ExportPanel.tsx       # Download & Cricut instructions
│   │   ├── services/
│   │   │   └── api.ts      # API client
│   │   └── types/
│   │       └── index.ts    # Frontend type definitions
│   └── package.json
└── package.json            # Root monorepo config
```

## API Contract

### POST /api/convert

Upload an image and convert to SVG.

**Request:**
- `multipart/form-data`
- `image`: Image file (PNG, JPG, GIF, BMP, max 10MB)
- `settings`: JSON string with vectorization settings

**Settings Object:**
```typescript
{
  mode: 'silhouette' | 'multicolor' | 'lineart',
  detail: number,        // 0-100, path detail level
  smoothing: number,     // 0-100, curve smoothing
  colorLayers: number,   // 2-16, for multicolor mode
  minAreaThreshold: number,  // 0-5%, minimum region size
  background: 'transparent' | 'remove' | 'keep',
  targetWidth: number,   // Output width
  targetHeight: number,  // Output height
  unit: 'inches' | 'mm',
  threshold?: number     // 0-255, for silhouette mode
}
```

**Response:**
```typescript
{
  svg: string,           // SVG XML string
  layers: LayerInfo[],   // Layer metadata
  stats: {
    totalPaths: number,
    totalPoints: number,
    processingTimeMs: number,
    originalWidth: number,
    originalHeight: number,
    outputWidth: number,
    outputHeight: number
  },
  warning?: string,      // Complexity warning
  requestId: string
}
```

### GET /api/health

Health check endpoint.

**Response:**
```typescript
{
  status: 'healthy',
  timestamp: string,
  uptime: number,
  memory: { used: number, total: number }
}
```

## SVG Output Format

Generated SVGs are Cricut Design Space compatible:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="6inches" height="4inches"
     viewBox="0 0 1200 800">
  <g id="layer-0" data-name="Layer 1">
    <path d="M..." fill="#000000"/>
  </g>
  <g id="layer-1" data-name="Layer 2">
    <path d="M..." fill="#ff0000"/>
  </g>
</svg>
```

**Compatibility Rules:**
- SVG 1.1 with XML declaration
- Width/height in inches or mm with matching viewBox
- Only vector elements: `<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, `<g>`
- No `<image>` tags, embedded fonts, or external CSS
- Colors and styles inline

## Conversion Modes

### Silhouette Mode
- Converts to binary black/white using threshold
- Good for: logos, icons, simple graphics
- Output: Single layer, solid fills

### Multi-Color Mode
- K-means color quantization to N colors
- Traces each color as separate layer
- Good for: clipart, colorful graphics
- Output: Multiple layers, one per color

### Line Art Mode
- Sobel edge detection
- Traces outlines only
- Good for: sketches, drawings, photos
- Output: Single layer, line strokes

## Development

```bash
# Install all dependencies
npm run install:all

# Start development servers (frontend + backend)
npm run dev

# Build for production
npm run build
```

**Ports:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Sample Input/Output

**Input:** 500x500 PNG logo
**Settings:** mode=silhouette, detail=50, smoothing=50, targetWidth=4, unit=inches
**Output:** SVG with ~200 paths, 4x4 inches, imports correctly into Design Space

## Key Dependencies

**Backend:**
- `express` - HTTP server
- `jimp` - Image processing
- `potrace` - Bitmap to vector tracing
- `multer` - File upload handling

**Frontend:**
- `react` - UI framework
- `vite` - Build tool
- `tailwindcss` - Styling
