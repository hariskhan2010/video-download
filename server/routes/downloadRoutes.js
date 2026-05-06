const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/downloadController');

router.post('/download', downloadController.startDownload);
router.get('/status/:id', downloadController.getStatus);
router.get('/file/:id', downloadController.getFile);

module.exports = router;
