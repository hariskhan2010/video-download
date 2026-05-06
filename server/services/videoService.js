const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const downloadsDir = path.join(__dirname, '..', 'downloads');

if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

exports.downloadVideo = (url, jobId, quality) => {
  return new Promise((resolve, reject) => {
    const outputTemplate = path.join(downloadsDir, `${jobId}.%(ext)s`);
    
    const qualityFormat = quality === 'hd' 
      ? 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]'
      : 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]';
    
    exec(`yt-dlp -f ${qualityFormat} --merge-output-format mp4 -o "${outputTemplate}" "${url}"`, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      
      const files = fs.readdirSync(downloadsDir);
      const downloadedFile = files.find(f => f.startsWith(jobId));
      
      if (downloadedFile) {
        resolve(path.join(downloadsDir, downloadedFile));
      } else {
        reject(new Error('Downloaded file not found'));
      }
    });
  });
};
