require('dotenv').config();
const express = require('express');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.WEB_SERVER_PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (if needed)
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.send('Discord Auth2Bot API is running!');
});

// Auth routes (placeholder, implement your OAuth2 routes)
app.get('/auth', (req, res) => {
  res.send('Auth endpoint');
});

app.get('/auth/callback', (req, res) => {
  res.send('Auth callback endpoint');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app; 