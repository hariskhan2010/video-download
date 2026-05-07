const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const ytDlpPath = '/tmp/yt-dlp';

async function ensureBinary() {
  if (fs.existsSync(ytDlpPath)) return;

  try {
    await new Promise((resolve, reject) => {
      exec('yt-dlp --version', (err, out) => err ? reject(err) : resolve(out));
    });
    fs.writeFileSync(ytDlpPath, '#!/bin/sh\nexec yt-dlp "$@"\n', { mode: 0o755 });
    return;
  } catch {}

  const buf = await new Promise((resolve, reject) => {
    https.get('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let url = res.headers.location;
        if (url) {
          https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r2) => {
            if (r2.statusCode !== 200) { reject(new Error(`HTTP ${r2.statusCode}`)); return; }
            const c = []; r2.on('data', d => c.push(d)); r2.on('end', () => resolve(Buffer.concat(c)));
          }).on('error', reject);
          return;
        }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
        const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve(Buffer.concat(c)));
      }).on('error', reject);
  });
  fs.writeFileSync(ytDlpPath, buf, { mode: 0o755 });
}

const binaryReady = ensureBinary().catch(() => {});

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    await binaryReady;
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
