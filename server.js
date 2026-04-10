require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes — regenerate must be registered before /api/chat router (Express 5 path matching)
app.post('/api/chat/regenerate', require('./routes/regenerate'));
app.use('/api/chat',             require('./routes/chat'));
app.use('/api/sessions',              require('./routes/sessions'));
app.use('/api/sessions/:id/note',     require('./routes/notes'));
app.use('/api/characters',       require('./routes/characters'));
app.use('/api/builder',          require('./routes/builder'));

// Fallback: serve index.html for all non-API routes
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
