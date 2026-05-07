const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve(stdout);
    });
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const jobId = uuidv4();
  const downloadsDir = '/tmp/downloads';
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

  const outputPath = path.join(downloadsDir, `${jobId}.mp4`);

  try {
    await execPromise(
      `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputPath}" "${url}"`
    );

    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({ error: 'Download failed - output file not found' });
    }

    const stat = fs.statSync(outputPath);
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="video-${jobId}.mp4"`,
      'Content-Length': stat.size,
    });
    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
