const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Check if yt-dlp is available
  try {
    await new Promise((resolve, reject) => {
      exec('yt-dlp --version', (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  } catch {
    return res.status(500).json({
      error: 'yt-dlp is not installed. This API only works on the local Express server where yt-dlp is available.'
    });
  }

  const jobId = uuidv4();
  const jobsDir = '/tmp/jobs';
  const downloadsDir = '/tmp/downloads';
  if (!fs.existsSync(jobsDir)) fs.mkdirSync(jobsDir, { recursive: true });
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

  const job = { status: 'pending', url, filename: null, error: null };
  fs.writeFileSync(path.join(jobsDir, `${jobId}.json`), JSON.stringify(job));

  res.json({ jobId, status: 'pending' });

  try {
    job.status = 'downloading';
    fs.writeFileSync(path.join(jobsDir, `${jobId}.json`), JSON.stringify(job));

    const outputTemplate = path.join(downloadsDir, `${jobId}.%(ext)s`);

    exec(`yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputTemplate}" "${url}"`,
      (error, stdout, stderr) => {
        if (error) {
          job.status = 'error';
          job.error = stderr || error.message;
        } else {
          const files = fs.readdirSync(downloadsDir);
          const downloadedFile = files.find(f => f.startsWith(jobId));
          if (downloadedFile) {
            job.status = 'done';
            job.filename = path.join(downloadsDir, downloadedFile);
          } else {
            job.status = 'error';
            job.error = 'Downloaded file not found';
          }
        }
        fs.writeFileSync(path.join(jobsDir, `${jobId}.json`), JSON.stringify(job));
      }
    );
  } catch (error) {
    job.status = 'error';
    job.error = error.message;
    fs.writeFileSync(path.join(jobsDir, `${jobId}.json`), JSON.stringify(job));
  }
};
