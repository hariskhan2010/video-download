const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const youtubedl = require('@distube/yt-dlp');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const downloadsDir = '/tmp/downloads';
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const jobId = uuidv4();
  const outputTemplate = path.join(downloadsDir, `${jobId}.%(ext)s`);

  try {
    await youtubedl.exec(url, {
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      mergeOutputFormat: 'mp4',
      output: outputTemplate,
    });
  } catch (error) {
    return res.status(500).json({ error: `Download failed: ${error.message}` });
  }

  const files = fs.readdirSync(downloadsDir);
  const downloadedFile = files.find(f => f.startsWith(jobId));
  if (!downloadedFile) {
    return res.status(500).json({ error: 'Downloaded file not found' });
  }

  const filePath = path.join(downloadsDir, downloadedFile);
  const stat = fs.statSync(filePath);

  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Content-Disposition': `attachment; filename="video-${jobId}.mp4"`,
    'Content-Length': stat.size,
  });

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
};
