# Image to SVG

A browser-based tool that converts raster images (PNG/JPG) to SVG vector files compatible with Cricut Design Space.

## Features

- **Multiple Conversion Modes**
  - **Silhouette**: Single-color threshold-based conversion for logos and icons
  - **Multi-Color**: Color clustering with separate layers for colorful graphics
  - **Line Art**: Edge detection for sketches and drawings

- **Cricut-Compatible Output**
  - Pure vector SVG with path geometry (no embedded images)
  - Configurable real-world units (inches or mm)
  - Layer groups for easy manipulation in Design Space

- **Interactive Controls**
  - Detail level slider (fewer vs. more points)
  - Smoothing slider (sharp vs. smooth curves)
  - Background handling options
  - Custom output size

- **Preview & Export**
  - Live SVG preview with zoom and pan
  - Layer visibility toggles
  - One-click SVG download
  - Cricut import instructions

## Quick Start

```bash
# Install dependencies
npm run install:all

# Start development servers
npm run dev
```

Then open http://localhost:5173 in your browser.

## Usage

1. **Upload an image** - Drag and drop or click to browse (PNG, JPG, GIF, BMP)
2. **Configure settings** - Choose conversion mode, adjust detail and smoothing
3. **Generate SVG** - Click the Generate button to convert
4. **Preview and adjust** - Use the preview to check results, toggle layers
5. **Download** - Export SVG and import into Cricut Design Space

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Image Processing**: Jimp, Potrace

## API Endpoints

- `POST /api/convert` - Convert uploaded image to SVG
- `POST /api/convert/base64` - Convert base64 image to SVG
- `GET /api/health` - Health check

## License

MIT
