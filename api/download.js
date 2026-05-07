const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const isWin = process.platform === 'win32';
const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp_linux';
const ytDlpPath = path.join('/tmp', binaryName);

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
            const asset = release.assets.find(a => a.name === binaryName);
            if (!asset) return reject(new Error(`${binaryName} not found in release`));
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

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    await ensureBinary();
    if (!fs.existsSync(ytDlpPath)) return res.status(500).json({ error: 'yt-dlp not available' });

    const dir = '/tmp/downloads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const id = uuidv4();
    const out = path.join(dir, `${id}.%(ext)s`);

    await new Promise((resolve, reject) => {
      exec(`"${ytDlpPath}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${out}" "${url}"`,
        (err, stdout, stderr) => err ? reject(new Error(stderr || err.message)) : resolve(stdout));
    });

    const files = fs.readdirSync(dir);
    const f = files.find(x => x.startsWith(id));
    if (!f) return res.status(500).json({ error: 'File not found' });
    const fp = path.join(dir, f);
    const st = fs.statSync(fp);
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Disposition': `attachment; filename="video-${id}.mp4"`, 'Content-Length': st.size });
    fs.createReadStream(fp).pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
