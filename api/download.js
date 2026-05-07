const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const isWin = process.platform === 'win32';
const ytDlpName = isWin ? 'yt-dlp.exe' : 'yt-dlp_linux';
const ytDlpPath = path.join('/tmp', ytDlpName);
const JOBS_FILE = path.join('/tmp', 'jobs.json');
const DOWNLOADS_DIR = path.join('/tmp', 'downloads');

function readJobs() {
  if (!fs.existsSync(JOBS_FILE)) return {};
  return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
}

function saveJobs(jobs) {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs));
}

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
  return process.execPath;
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { url, cookies } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL is required' });
    if (!validateUrl(url)) return res.status(400).json({ error: 'Invalid or unsupported URL' });

    const jobId = uuidv4();
    const jobs = readJobs();
    jobs[jobId] = { status: 'pending', url, filename: null, error: null };
    saveJobs(jobs);

    res.json({ jobId, status: 'pending' });

    try {
      jobs[jobId].status = 'preparing';
      saveJobs(jobs);

      await ensureBinary();
      if (!fs.existsSync(ytDlpPath)) {
        jobs[jobId].status = 'error';
        jobs[jobId].error = 'yt-dlp not available';
        saveJobs(jobs);
        return;
      }

      if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

      if (cookies) {
        fs.writeFileSync('/tmp/cookies.txt', cookies);
      } else if (process.env.YOUTUBE_COOKIES) {
        fs.writeFileSync('/tmp/cookies.txt', process.env.YOUTUBE_COOKIES);
      }

      const cookiesFlag = fs.existsSync('/tmp/cookies.txt')
        ? `--cookies /tmp/cookies.txt`
        : '';

      const nodePath = getNodePath();
      const jsRuntimeFlag = `--js-runtimes "${nodePath}"`;
      const remoteComponentsFlag = '--remote-components ejs:github';

      const outputTemplate = path.join(DOWNLOADS_DIR, `${jobId}.%(ext)s`);

      jobs[jobId].status = 'downloading';
      saveJobs(jobs);

      const cmd = `"${ytDlpPath}" ${cookiesFlag} ${jsRuntimeFlag} ${remoteComponentsFlag} -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputTemplate}" "${url}"`;

      await new Promise((resolve, reject) => {
        exec(cmd, { maxBuffer: 1024 * 1024 * 100 }, (err, stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message));
          else resolve(stdout);
        });
      });

      const files = fs.readdirSync(DOWNLOADS_DIR);
      const f = files.find(x => x.startsWith(jobId));
      if (!f) throw new Error('Downloaded file not found');
      const fp = path.join(DOWNLOADS_DIR, f);

      jobs[jobId].status = 'done';
      jobs[jobId].filename = fp;
      saveJobs(jobs);
    } catch (err) {
      jobs[jobId].status = 'error';
      jobs[jobId].error = err.message;
      saveJobs(jobs);
    }
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};
