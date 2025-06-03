const express = require('express');
const cors = require('cors');
const morgan = require('morgan'); // Import morgan
const logger = require('./logger'); // Import the logger
// require('dotenv').config(); // dotenv is called in utils.js
const { model } = require('./utils.js'); // Adjusted path
const { GEMINI_COMBO_PROMPT, GEMINI_HINT_PROMPT_TEMPLATE } = require('./prompts.js'); // Adjusted path

const predefinedCombos = [
  { emojis: "⭐🔑", correct_answer: "Starkey", options: ["Keystar", "Starkey", "Star K", "Astrokey"] },
  { emojis: "🌲🏠", correct_answer: "Treehouse", options: ["Woodhome", "Foresthut", "Treehouse", "Logcabin"] },
  { emojis: "🤖💻", correct_answer: "Robot Computer", options: ["Cyborg CPU", "AI Machine", "Bot Processor", "Robot Computer"] },
  { emojis: "☀️👓", correct_answer: "Sunglasses", options: ["Sunnies", "Dayshades", "Sunglasses", "Lightfilters"] },
  { emojis: "📚🐛", correct_answer: "Bookworm", options: ["Readbug", "Pagegrub", "Storygrub", "Bookworm"] }
];

async function generateWithRetry(promptOrContent, maxRetries = 3, initialDelay = 1000) {
  let retries = 0;
  let currentDelay = initialDelay;
  while (retries < maxRetries) {
    try {
      logger.info(`Calling Gemini API. Attempt ${retries + 1} of ${maxRetries}.`, { promptIdentifier: typeof promptOrContent === 'string' && promptOrContent.length < 100 ? promptOrContent.substring(0,100) : 'Content Object' });
      const result = await model.generateContent(promptOrContent);
      logger.info(`Gemini API call successful. Attempt ${retries + 1}.`);
      return result;
    } catch (error) {
      retries++;
      // TODO: Add specific check for rate limit errors from Gemini
      // if (error.isRateLimitError) { /* handle differently, maybe don't retry or use longer backoff */ }
      logger.warn(`Gemini API call attempt ${retries} failed. Retrying in ${currentDelay}ms...`, { error: error.message, stack: error.stack });
      if (retries >= maxRetries) {
        logger.error('Max retries reached for Gemini API call. Failing.', { promptIdentifier: typeof promptOrContent === 'string' && promptOrContent.length < 100 ? promptOrContent.substring(0,100) : 'Content Object', error: error.message, stack: error.stack });
        throw error; // Re-throw the last error
      }
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= 2; // Exponential backoff
    }
  }
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // For parsing application/json

// Morgan setup to stream HTTP logs to Winston
const morganStream = {
  write: (message) => {
    // Morgan typically includes a newline, remove it to avoid double newlines in JSON logs
    logger.http(message.trim());
  }
};
app.use(morgan('combined', { stream: morganStream }));


// Routes
app.get('/', (req, res) => {
  res.send('Welcome to the AI Emoji Game server!');
});

app.get('/combo', async (req, res) => {
  logger.info('Received request for /combo');
  if (!model) {
    logger.error('Generative model not initialized for /combo route.');
    return res.status(500).json({ message: 'Generative model not initialized. Check server logs.' });
  }
  let cleanedJson; // Declare here to make it accessible in the outer catch if needed, though primarily for inner.
  let parsedData;  // Declare here

  try {
    logger.info('Attempting to generate emoji combo from Gemini API using GEMINI_COMBO_PROMPT.');
    const result = await generateWithRetry(GEMINI_COMBO_PROMPT);
    const response = await result.response;
    const text = response.text();

    // Clean the response to ensure it's valid JSON
    // Gemini might sometimes return the JSON block within backticks and with "json" prefix
    cleanedJson = text.trim(); // Assign to the higher-scoped variable
    if (cleanedJson.startsWith('```json')) {
      cleanedJson = cleanedJson.substring(7);
    }
    if (cleanedJson.endsWith('```')) {
      cleanedJson = cleanedJson.substring(0, cleanedJson.length - 3);
    }
    cleanedJson = cleanedJson.trim(); // Trim again after removing backticks

    try {
      parsedData = JSON.parse(cleanedJson); // Assign to the higher-scoped variable
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        logger.error('Error parsing JSON response from Gemini for /combo.', { error: parseError.message, details: parseError.stack, rawText: cleanedJson });
        return res.status(500).json({ message: 'Failed to parse game data from AI. The AI response was not valid JSON.', details: parseError.message });
      }
      throw parseError; // Re-throw if it's not a SyntaxError, to be caught by outer catch
    }

    // Validate the structure of parsedData for /combo
    if (
      !parsedData ||
      typeof parsedData.emojis !== 'string' ||
      typeof parsedData.correct_answer !== 'string' ||
      !Array.isArray(parsedData.options) ||
      parsedData.options.length !== 4 ||
      !parsedData.options.every(opt => typeof opt === 'string')
    ) {
      logger.error('Unexpected Gemini API response structure for /combo.', { responseData: parsedData });
      throw new Error('Unexpected Gemini API response structure for /combo');
    }
    logger.info('Successfully generated and parsed combo from Gemini API for /combo.');
    res.json(parsedData);
  } catch (error) {
    logger.error('Error in /combo route after attempting Gemini API call (and retries).', { errorMessage: error.message, stack: error.stack, errorDetails: error });
    // The error object might have response data if it's an API error from Gemini that slipped through generateWithRetry (e.g. non-retryable)
    if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
      logger.error('Gemini API Error details in /combo catch:', { apiError: error.response.data.error.message });
    }

    // Fallback to predefinedCombos
    try {
      const randomIndex = Math.floor(Math.random() * predefinedCombos.length);
      const cachedCombo = predefinedCombos[randomIndex];
      logger.warn('Gemini API failed for /combo (even after retries), serving from cache. Failure might be due to rate limits or other issues.', { fallbackReason: error.message });
      return res.status(200).json({
        ...cachedCombo,
        fromCache: true,
        message: "Serving from cache due to API error after retries."
      });
    } catch (cacheError) {
      logger.error('Error serving combo from cache after primary error.', { originalError: error.message, cacheFallbackError: cacheError.message, stack: cacheError.stack });
      return res.status(500).json({
        message: 'Failed to generate emoji combination and also failed to serve from cache. Please check server logs.',
        originalError: error.message, // Include the original error message
        cacheError: cacheError.message // Include the cache error message
      });
    }
  }
});

app.post('/hint', async (req, res) => {
  logger.info('Received request for /hint');
  try {
    const { phrase } = req.body;

    // Input validation already includes logging for specific failures.
    if (!phrase) {
      logger.warn('Validation failed for /hint: Phrase is required.');
      return res.status(400).json({ message: 'Phrase is required in the request body.' });
    }

    if (typeof phrase !== 'string') {
      logger.warn('Validation failed for /hint: Phrase must be a string.', { receivedType: typeof phrase });
      return res.status(400).json({ message: 'Phrase must be a string.' });
    }

    if (phrase.trim().length === 0) {
      logger.warn('Validation failed for /hint: Phrase cannot be empty or just whitespace.');
      return res.status(400).json({ message: 'Phrase cannot be empty or just whitespace.' });
    }

    if (phrase.length > 200) { // Example max length
      logger.warn('Validation failed for /hint: Phrase is too long.', { length: phrase.length });
      return res.status(400).json({ message: 'Phrase is too long. Maximum 200 characters allowed.' });
    }

    if (!model) {
      logger.error('Generative model not initialized for /hint route.');
      return res.status(500).json({ message: 'Generative model not initialized. Check server logs.' });
    }

    const prompt = GEMINI_HINT_PROMPT_TEMPLATE.replace('{USER_PHRASE}', phrase);
    logger.info('Attempting to generate hint from Gemini API.', { promptIdentifier: 'GEMINI_HINT_PROMPT_TEMPLATE' });

    const result = await generateWithRetry(prompt);
    const response = await result.response;
    const hintText = response.text().trim();

    // Validate the structure of hintText for /hint
    if (typeof hintText !== 'string' || hintText.length === 0) {
      logger.error('Unexpected Gemini API response structure for /hint (empty or not a string).', { hintTextReceived: hintText });
      throw new Error('Unexpected Gemini API response structure for /hint');
    }
    logger.info('Successfully generated hint from Gemini API for /hint.');
    res.json({ hint: hintText });
  } catch (error) {
    logger.error('Error in /hint route after attempting Gemini API call (and retries).', { errorMessage: error.message, stack: error.stack, errorDetails: error });
     // Check if the error is from Gemini API itself
    if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
      logger.error('Gemini API Error details in /hint catch:', { apiError: error.response.data.error.message });
      // It might be better to send a generic message for Gemini API errors to client,
      // as specific messages could be too technical or reveal too much.
      // For now, keeping the existing behavior of sending Gemini's message.
      return res.status(500).json({ message: `Error from Gemini API: ${error.response.data.error.message}` });
    }
    res.status(500).json({ message: 'Failed to generate hint. Please ensure your GEMINI_API_KEY is set correctly and the API is reachable.' });
  }
});

// Error handling middleware (should be after all routes)
function errorHandlerMiddleware(err, req, res, next) {
  // Log detailed error information for internal debugging
  logger.error('Unhandled error caught by errorHandlerMiddleware:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl, // or req.path
    method: req.method,
    // You could add more context like request body if it's not too large or sensitive
    // requestBody: req.body
  });

  // For client-facing response, keep it generic and structured
  res.status(500).json({
    error: 'ERR_INTERNAL_SERVER', // An error code
    message: 'An unexpected error occurred on the server.'
  });
}

app.use(errorHandlerMiddleware);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
