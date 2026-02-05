# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Four Frames One Moment (4fram.es) transforms Lomo Action Sampler photos into stabilized animated GIFs. The camera captures 4 sequential photos in a 2x2 grid on a single film frame; this app splits, aligns, and animates them.

## Commands

```bash
npm install          # Install dependencies
npm start            # Start dev server on port 3000
git push dokku main  # Deploy to production
```

**System requirement:** ImageMagick must be installed (`brew install imagemagick` on macOS).

## Architecture

Single-page app with Node.js/Express backend:

- `server.js` - Express server with image processing logic
  - `POST /api/process` - Upload and process Lomo image
  - `GET /api/gif/:id` - Retrieve generated GIF
  - `GET /api/download/:id` - Download GIF
- `public/index.html` - Complete frontend (HTML + CSS + JS in one file)

**Processing pipeline (server.js):**
1. Extract 4 quadrants from uploaded image (TL, TR, BL, BR)
2. Auto-orient based on EXIF data
3. Downsample frames to 25% for fast alignment analysis
4. Calculate alignment offsets using ImageMagick RMSE comparison (±12px range)
5. Apply SRT (Scale Rotate Translate) distortion to align frames
6. Create GIF with frame order: TL → BL → BR → TR (matches camera firing sequence)
7. Clean up temp files in `/tmp/lomo-uploads/` and `/tmp/lomo-output/`

Image processing uses ImageMagick `convert` and `identify` commands via `execSync`.

## Key Implementation Details

- 50MB upload limit
- 25ms delay between GIF frames
- Alignment search: ±12px range at 2px intervals on 25% downsampled images, then scaled 4x
- Frame order hardcoded at line ~103 in server.js
