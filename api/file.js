const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  const jobId = req.query.id;
  if (!jobId) return res.status(400).json({ error: 'Missing file id' });

  const filePath = path.join('/tmp', 'downloads', `${jobId}.mp4`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found or expired' });
  }

  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Content-Disposition': `attachment; filename="video-${jobId}.mp4"`,
    'Content-Length': stat.size,
  });
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
};
