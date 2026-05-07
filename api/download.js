const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ytdl = require('yt-dlp-exec');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const dir = '/tmp/downloads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const id = uuidv4();
    const out = path.join(dir, `${id}.%(ext)s`);

    await ytdl.exec(url, {
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      mergeOutputFormat: 'mp4',
      output: out,
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
