const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const JOBS_FILE = path.join('/tmp', 'jobs.json');

function readJobs() {
  if (!fs.existsSync(JOBS_FILE)) return {};
  return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
}

function writeJobs(jobs) {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const jobId = uuidv4();
  const jobs = readJobs();
  jobs[jobId] = { status: 'pending', url, filename: null, error: null };
  writeJobs(jobs);

  res.json({ jobId, status: 'pending' });

  try {
    jobs[jobId].status = 'downloading';
    writeJobs(jobs);
    
    const downloadsDir = '/tmp/downloads';
    if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
    
    const outputTemplate = path.join(downloadsDir, `${jobId}.%(ext)s`);
    
    exec(`yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputTemplate}" "${url}"`, 
      (error, stdout, stderr) => {
        if (error) {
          jobs[jobId].status = 'error';
          jobs[jobId].error = stderr || error.message;
        } else {
          const files = fs.readdirSync(downloadsDir);
          const downloadedFile = files.find(f => f.startsWith(jobId));
          if (downloadedFile) {
            jobs[jobId].status = 'done';
            jobs[jobId].filename = path.join(downloadsDir, downloadedFile);
          }
        }
        writeJobs(jobs);
      }
    );
  } catch (error) {
    jobs[jobId].status = 'error';
    jobs[jobId].error = error.message;
    writeJobs(jobs);
  }
};
