const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  const jobId = req.query.id;
  if (!jobId) return res.status(400).json({ error: 'Missing job ID' });

  const jobPath = path.join('/tmp', 'jobs', `${jobId}.json`);

  if (!fs.existsSync(jobPath)) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
  res.json(job);
};
