const express = require('express');
const cors = require('cors');
// require('dotenv').config(); // dotenv is called in utils.js
const { model } = require('./utils.js'); // Adjusted path
const { GEMINI_COMBO_PROMPT, GEMINI_HINT_PROMPT_TEMPLATE } = require('./prompts.js'); // Adjusted path

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // For parsing application/json

// Routes
app.get('/', (req, res) => {
  res.send('Welcome to the AI Emoji Game server!');
});

app.get('/combo', async (req, res) => {
  if (!model) {
    return res.status(500).json({ message: 'Generative model not initialized. Check server logs.' });
  }
  try {
    const result = await model.generateContent(GEMINI_COMBO_PROMPT);
    const response = await result.response;
    const text = response.text();

    // Clean the response to ensure it's valid JSON
    // Gemini might sometimes return the JSON block within backticks and with "json" prefix
    let cleanedJson = text.trim();
    if (cleanedJson.startsWith('```json')) {
      cleanedJson = cleanedJson.substring(7);
    }
    if (cleanedJson.endsWith('```')) {
      cleanedJson = cleanedJson.substring(0, cleanedJson.length - 3);
    }
    cleanedJson = cleanedJson.trim(); // Trim again after removing backticks

    const parsedData = JSON.parse(cleanedJson);
    res.json(parsedData);
  } catch (error) {
    console.error('Error generating emoji combo:', error);
    // Check if the error is from Gemini API itself
    if (error.response && error.response.data) {
      console.error('Gemini API Error:', error.response.data);
      // Try to send a more specific error message if available
      if (error.response.data.error && error.response.data.error.message) {
        return res.status(500).json({ message: `Error from Gemini API: ${error.response.data.error.message}` });
      }
    }
    res.status(500).json({ message: 'Failed to generate emoji combination. Please ensure your GEMINI_API_KEY is set correctly and the API is reachable.' });
  }
});

app.post('/hint', async (req, res) => {
  try {
    const { phrase } = req.body;

    if (!phrase) {
      return res.status(400).json({ message: 'Phrase is required in the request body.' });
    }

    if (!model) {
      return res.status(500).json({ message: 'Generative model not initialized. Check server logs.' });
    }

    const prompt = GEMINI_HINT_PROMPT_TEMPLATE.replace('{USER_PHRASE}', phrase);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const hintText = response.text().trim();

    res.json({ hint: hintText });
  } catch (error) {
    console.error('Error generating hint:', error);
    // Check if the error is from Gemini API itself
    if (error.response && error.response.data) {
      console.error('Gemini API Error:', error.response.data);
      // Try to send a more specific error message if available
      if (error.response.data.error && error.response.data.error.message) {
        return res.status(500).json({ message: `Error from Gemini API: ${error.response.data.error.message}` });
      }
    }
    res.status(500).json({ message: 'Failed to generate hint. Please ensure your GEMINI_API_KEY is set correctly and the API is reachable.' });
  }
});

// Error handling middleware (should be after all routes)
function errorHandlerMiddleware(err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
}

app.use(errorHandlerMiddleware);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
