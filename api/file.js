const fs = require('fs');
const path = require('path');

const JOBS_FILE = path.join('/tmp', 'jobs.json');
const DOWNLOADS_DIR = path.join('/tmp', 'downloads');

function readJobs() {
  if (!fs.existsSync(JOBS_FILE)) return {};
  return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
}

module.exports = async (req, res) => {
  const jobId = req.query.id;
  if (!jobId) return res.status(400).json({ error: 'Job ID required' });

  const jobs = readJobs();
  const job = jobs[jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'done') return res.status(400).json({ error: `Job status: ${job.status}` });
  if (!job.filename || !fs.existsSync(job.filename)) return res.status(404).json({ error: 'File not found' });

  const stat = fs.statSync(job.filename);
  const ext = path.extname(job.filename).toLowerCase();
  const mime = ext === '.mp4' ? 'video/mp4' : ext === '.webm' ? 'video/webm' : ext === '.mkv' ? 'video/x-matroska' : 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Disposition': `attachment; filename="video-${jobId}.mp4"`,
    'Content-Length': stat.size,
  });
  fs.createReadStream(job.filename).pipe(res);
};
