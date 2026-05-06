const express = require('express');
const cors = require('cors');
const path = require('path');
const downloadRoutes = require('./routes/downloadRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));
app.use(express.static(path.join(__dirname, '..', 'client')));

app.use('/api', downloadRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
