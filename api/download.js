const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const builtBinary = path.join(__dirname, 'yt-dlp');
const ytDlpPath = fs.existsSync(builtBinary) ? builtBinary : '/tmp/yt-dlp';

async function ensureBinary() {
  if (fs.existsSync(ytDlpPath)) return;

  try {
    await new Promise((resolve, reject) => {
      exec('yt-dlp --version', (err, out) => err ? reject(err) : resolve(out));
    });
    if (ytDlpPath === '/tmp/yt-dlp') {
      fs.writeFileSync(ytDlpPath, '#!/bin/sh\nexec yt-dlp "$@"\n', { mode: 0o755 });
    }
    return;
  } catch {}

  await new Promise((resolve, reject) => {
    exec(`curl -L -o "${ytDlpPath}" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" && chmod +x "${ytDlpPath}"`,
      (err, stdout, stderr) => err ? reject(new Error(stderr || err.message)) : resolve(stdout));
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    await ensureBinary();
    if (!fs.existsSync(ytDlpPath)) return res.status(500).json({ error: 'yt-dlp binary not found' });

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
    if (!f) return res.status(500).json({ error: 'Downloaded file not found' });
    const fp = path.join(dir, f);
    const st = fs.statSync(fp);
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Disposition': `attachment; filename="video-${id}.mp4"`, 'Content-Length': st.size });
    fs.createReadStream(fp).pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
