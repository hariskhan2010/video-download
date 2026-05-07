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

  const result = { jobId, status: job.status, error: job.error || null };

  if (job.status === 'done' && job.filename && fs.existsSync(job.filename)) {
    const stat = fs.statSync(job.filename);
    result.fileSize = stat.size;
  }

  res.json(result);
};
