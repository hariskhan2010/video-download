const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const isWin = process.platform === 'win32';
const ytDlpName = isWin ? 'yt-dlp.exe' : 'yt-dlp_linux';
const ytDlpPath = path.join('/tmp', ytDlpName);
const DOWNLOADS_DIR = path.join('/tmp', 'downloads');

async function ensureBinary() {
  if (fs.existsSync(ytDlpPath)) return;
  try {
    await new Promise((resolve, reject) => {
      exec('yt-dlp --version', (err, out) => err ? reject(err) : resolve(out));
    });
    return;
  } catch {}

  const buf = await new Promise((resolve, reject) => {
    https.get('https://api.github.com/repos/yt-dlp/yt-dlp/releases?per_page=1',
      { headers: { 'User-Agent': 'video-downloader' } }, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const [release] = JSON.parse(d);
            const asset = release.assets.find(a => a.name === ytDlpName);
            if (!asset) return reject(new Error(`${ytDlpName} not found`));
            const url = asset.browser_download_url;
            https.get(url, { headers: { 'User-Agent': 'video-downloader' } }, (r2) => {
              if (r2.statusCode >= 300 && r2.headers.location) {
                https.get(r2.headers.location, (r3) => {
                  const c = []; r3.on('data', x => c.push(x));
                  r3.on('end', () => resolve(Buffer.concat(c)));
                }).on('error', reject);
                return;
              }
              if (r2.statusCode !== 200) return reject(new Error(`HTTP ${r2.statusCode}`));
              const c = []; r2.on('data', x => c.push(x));
              r2.on('end', () => resolve(Buffer.concat(c)));
            }).on('error', reject);
          } catch (e) { reject(e); }
        });
      }).on('error', reject);
  });
  fs.writeFileSync(ytDlpPath, buf, { mode: 0o755 });
}

function validateUrl(url) {
  try {
    const u = new URL(url);
    const supported = ['youtube.com', 'www.youtube.com', 'youtu.be', 'facebook.com', 'www.facebook.com',
      'fb.watch', 'instagram.com', 'www.instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
      'www.tiktok.com', 'vimeo.com', 'www.vimeo.com', 'dailymotion.com', 'www.dailymotion.com'];
    return supported.some(d => u.hostname === d || u.hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

function getNodePath() {
  const p = process.execPath;
  return isWin ? p : (p || '/usr/bin/node');
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL is required' });
    if (!validateUrl(url)) return res.status(400).json({ error: 'Invalid or unsupported URL' });

    await ensureBinary();
    if (!fs.existsSync(ytDlpPath)) return res.status(500).json({ error: 'yt-dlp not available' });

    if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

    const nodePath = getNodePath();
    const id = uuidv4();
    const outputTemplate = path.join(DOWNLOADS_DIR, `${id}.%(ext)s`);

    const cmd = `"${ytDlpPath}" --js-runtimes "${nodePath}" --remote-components ejs:github --extractor-args "youtube:player_client=default" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputTemplate}" "${url}"`;

    await new Promise((resolve, reject) => {
      exec(cmd, { maxBuffer: 1024 * 1024 * 100 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      });
    });

    const files = fs.readdirSync(DOWNLOADS_DIR);
    const f = files.find(x => x.startsWith(id));
    if (!f) return res.status(500).json({ error: 'Downloaded file not found' });
    const fp = path.join(DOWNLOADS_DIR, f);
    const stat = fs.statSync(fp);

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="video.mp4"`,
      'Content-Length': stat.size,
    });
    fs.createReadStream(fp).pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};
