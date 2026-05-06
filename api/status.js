const fs = require('fs');
const path = require('path');

const JOBS_FILE = path.join('/tmp', 'jobs.json');

function readJobs() {
  if (!fs.existsSync(JOBS_FILE)) return {};
  return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
}

module.exports = async (req, res) => {
  const jobId = req.query.id;
  const jobs = readJobs();
  const job = jobs[jobId];
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(job);
};
