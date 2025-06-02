const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load environment variables
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // For parsing application/json

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// Routes
app.get('/', (req, res) => {
  res.send('Welcome to the AI Emoji Game server!');
});

app.get('/combo', async (req, res) => {
  try {
    const prompt = `
      Generate a two-emoji combination that represents a common phrase, movie, book, or concept.
      Also provide one correct answer for what the emojis represent, and three plausible but incorrect distractor options.
      Return the output as a JSON object with the following structure:
      {
        "emojis": "String of two emojis",
        "correct_answer": "String of the correct answer",
        "options": ["Array of four strings: one correct answer and three distractors, shuffled"]
      }
      Ensure the options array is shuffled.
      For example:
      {
        "emojis": "🧑‍🍳💋",
        "correct_answer": "Chef's Kiss",
        "options": ["Chef's Kiss", "Cooking Love", "Kiss the Cook", "Delicious Food"]
      }
      Another example:
      {
        "emojis": "💔➡️",
        "correct_answer": "Heartbreak to Healing",
        "options": ["Heartbreak to Healing", "Broken Arrow", "Love Hurts then Moves On", "Sad Direction"]
      }
      Ensure the response is only the JSON object, with no other text before or after it.
    `;

    const result = await model.generateContent(prompt);
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

    const prompt = `
      Provide a short, non-obvious hint for the following phrase. The phrase might be a word, a common saying, a movie title, a book title, or a general concept.
      The hint should be clever and not give away the answer directly. Aim for 1-2 sentences.

      Phrase: "${phrase}"

      Hint:
    `;

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
