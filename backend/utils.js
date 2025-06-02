require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not set. Please ensure it is defined in your .env file.');
  // Optionally, throw an error if the API key is critical for the module to function
  // throw new Error('GEMINI_API_KEY is not set. Application cannot start.');
}

let model;

try {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: 'gemini-pro' });
} catch (error) {
  console.error("Failed to initialize GoogleGenerativeAI. Ensure GEMINI_API_KEY is valid.", error);
  // Depending on desired behavior, you might re-throw the error or export a non-functional model
  // For now, model will be undefined, and dependent parts of the app should handle this.
}

module.exports = { model };
