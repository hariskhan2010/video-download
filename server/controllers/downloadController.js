const { v4: uuidv4 } = require('uuid');
const videoService = require('../services/videoService');

const jobs = new Map();

exports.startDownload = async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const jobId = uuidv4();
  jobs.set(jobId, { status: 'pending', url, filename: null, error: null });

  res.json({ jobId, status: 'pending' });

  try {
    jobs.set(jobId, { ...jobs.get(jobId), status: 'downloading' });
    const filename = await videoService.downloadVideo(url, jobId);
    jobs.set(jobId, { status: 'done', url, filename, error: null });
  } catch (error) {
    jobs.set(jobId, { ...jobs.get(jobId), status: 'error', error: error.message });
  }
};

exports.getStatus = (req, res) => {
  const { id } = req.params;
  const job = jobs.get(id);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(job);
};

exports.getFile = (req, res) => {
  const { id } = req.params;
  const job = jobs.get(id);
  
  if (!job || job.status !== 'done') {
    return res.status(404).json({ error: 'File not ready' });
  }
  
  res.download(job.filename);
};
