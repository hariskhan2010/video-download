const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const ytDlpPath = '/tmp/yt-dlp';

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function ensureBinary() {
  if (fs.existsSync(ytDlpPath)) return;

  const apiUrl = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases?per_page=1';
  const apiRes = await new Promise((resolve, reject) => {
    https.get(apiUrl, { headers: { 'User-Agent': 'video-downloader' } }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`API HTTP ${res.statusCode}`)); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
    }).on('error', reject);
  });

  const asset = apiRes[0]?.assets?.find(a => a.name === 'yt-dlp');
  if (!asset?.browser_download_url) throw new Error('yt-dlp binary asset not found');

  const buf = await httpsGet(asset.browser_download_url);
  fs.writeFileSync(ytDlpPath, buf, { mode: 0o755 });
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    await ensureBinary();

    const downloadsDir = '/tmp/downloads';
    if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

    const jobId = uuidv4();
    const outputTemplate = path.join(downloadsDir, `${jobId}.%(ext)s`);

    await new Promise((resolve, reject) => {
      exec(
        `"${ytDlpPath}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputTemplate}" "${url}"`,
        (error, stdout, stderr) => {
          if (error) reject(new Error(stderr || error.message));
          else resolve(stdout);
        }
      );
    });

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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
