const express = require('express');
const multer = require('multer');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/lomo-uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Serve static files
app.use(express.static('public'));

// Create output directory
const outputDir = '/tmp/lomo-output';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Process uploaded image
app.post('/api/process', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  const inputPath = req.file.path;
  const outputId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const outputPath = path.join(outputDir, `${outputId}.gif`);

  try {
    // Auto-orient image based on EXIF data
    execSync(`convert "${inputPath}" -auto-orient "${inputPath}_oriented.png"`);
    const orientedPath = `${inputPath}_oriented.png`;

    // Get image dimensions
    const dims = execSync(`identify -format "%w %h" "${orientedPath}"`).toString().trim().split(' ');
    const w = parseInt(dims[0]);
    const h = parseInt(dims[1]);
    const hw = Math.floor(w / 2);
    const hh = Math.floor(h / 2);

    const tmp = `/tmp/lomo_${outputId}`;

    // Extract 4 quadrants
    execSync(`convert "${orientedPath}" -crop ${hw}x${hh}+0+0 +repage "${tmp}_f0.png"`);
    execSync(`convert "${orientedPath}" -crop ${hw}x${hh}+${hw}+0 +repage "${tmp}_f1.png"`);
    execSync(`convert "${orientedPath}" -crop ${hw}x${hh}+0+${hh} +repage "${tmp}_f2.png"`);
    execSync(`convert "${orientedPath}" -crop ${hw}x${hh}+${hw}+${hh} +repage "${tmp}_f3.png"`);

    // Downsample for alignment
    for (let i = 0; i < 4; i++) {
      execSync(`convert "${tmp}_f${i}.png" -resize 25% "${tmp}_s${i}.png"`);
    }

    // Find alignment offsets
    const findOffset = (refIdx, frameIdx) => {
      let bestScore = 1;
      let bestX = 0, bestY = 0;

      for (let dx = -12; dx <= 12; dx += 2) {
        for (let dy = -12; dy <= 12; dy += 2) {
          try {
            const result = execSync(
              `convert "${tmp}_s${refIdx}.png" \\( "${tmp}_s${frameIdx}.png" -distort SRT "0,0 1 0 ${dx},${dy}" \\) ` +
              `-gravity center -crop 50%x50%+0+0 +repage -metric RMSE -compare -format "%[distortion]" info: 2>&1`
            ).toString();
            const score = parseFloat(result.match(/^[\d.]+/)?.[0] || '1');
            if (score < bestScore) {
              bestScore = score;
              bestX = dx;
              bestY = dy;
            }
          } catch (e) {}
        }
      }
      return { x: bestX * 4, y: bestY * 4 };
    };

    const off1 = findOffset(0, 1);
    const off2 = findOffset(0, 2);
    const off3 = findOffset(0, 3);

    // Apply alignment
    execSync(`cp "${tmp}_f0.png" "${tmp}_a0.png"`);
    execSync(`convert "${tmp}_f1.png" -distort SRT "0,0 1 0 ${off1.x},${off1.y}" "${tmp}_a1.png"`);
    execSync(`convert "${tmp}_f2.png" -distort SRT "0,0 1 0 ${off2.x},${off2.y}" "${tmp}_a2.png"`);
    execSync(`convert "${tmp}_f3.png" -distort SRT "0,0 1 0 ${off3.x},${off3.y}" "${tmp}_a3.png"`);

    // Calculate crop
    const offsets = [off1.x, off1.y, off2.x, off2.y, off3.x, off3.y];
    const maxOffset = Math.max(...offsets.map(Math.abs));
    const margin = 50 + maxOffset;
    const cw = hw - margin * 2;
    const ch = hh - margin * 2;

    // Create GIF with frame order: TL → BL → BR → TR
    execSync(
      `convert "${tmp}_a0.png" "${tmp}_a2.png" "${tmp}_a3.png" "${tmp}_a1.png" ` +
      `-gravity center -crop ${cw}x${ch}+0+0 +repage -set delay 25 -loop 0 "${outputPath}"`
    );

    // Cleanup temp files
    for (let i = 0; i < 4; i++) {
      try {
        fs.unlinkSync(`${tmp}_f${i}.png`);
        fs.unlinkSync(`${tmp}_s${i}.png`);
        fs.unlinkSync(`${tmp}_a${i}.png`);
      } catch (e) {}
    }
    try { fs.unlinkSync(orientedPath); } catch (e) {}
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      gifId: outputId,
      dimensions: { width: cw, height: ch }
    });

  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// Serve generated GIF
app.get('/api/gif/:id', (req, res) => {
  const gifPath = path.join(outputDir, `${req.params.id}.gif`);
  if (fs.existsSync(gifPath)) {
    res.sendFile(gifPath);
  } else {
    res.status(404).json({ error: 'GIF not found' });
  }
});

// Download GIF
app.get('/api/download/:id', (req, res) => {
  const gifPath = path.join(outputDir, `${req.params.id}.gif`);
  if (fs.existsSync(gifPath)) {
    res.download(gifPath, `lomo-${req.params.id}.gif`);
  } else {
    res.status(404).json({ error: 'GIF not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Lomo GIF Lab running at http://localhost:${PORT}`);
});
