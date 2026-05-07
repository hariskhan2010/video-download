const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const ytDlpDir = '/tmp/yt-dlp-bin';
const ytDlpPath = path.join(ytDlpDir, `yt-dlp${process.platform === 'win32' ? '.exe' : ''}`);

async function ensureBinary() {
  if (fs.existsSync(ytDlpPath)) return;
  if (!fs.existsSync(ytDlpDir)) fs.mkdirSync(ytDlpDir, { recursive: true });

  const apiRes = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases?per_page=1');
  const [release] = await apiRes.json();
  const asset = release.assets.find(a => a.name === 'yt-dlp');
  if (!asset) throw new Error('yt-dlp binary asset not found in latest release');

  const res = await fetch(asset.browser_download_url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(ytDlpPath, buf, { mode: 0o755 });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    await ensureBinary();
  } catch (error) {
    return res.status(500).json({ error: `Failed to get yt-dlp: ${error.message}` });
  }

  const downloadsDir = '/tmp/downloads';
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const jobId = uuidv4();
  const outputTemplate = path.join(downloadsDir, `${jobId}.%(ext)s`);

  try {
    await new Promise((resolve, reject) => {
      exec(
        `"${ytDlpPath}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputTemplate}" "${url}"`,
        (error, stdout, stderr) => {
          if (error) reject(new Error(stderr || error.message));
          else resolve(stdout);
        }
      );
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
