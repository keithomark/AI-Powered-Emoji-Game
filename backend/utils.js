require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let model;

if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_API_KEY_HERE") {
  console.error("********************************************************************************");
  console.error("ERROR: GEMINI_API_KEY is missing or is still set to the placeholder value.");
  console.error("Please set your actual GEMINI_API_KEY in the backend/.env file.");
  console.error("The AI functionalities will NOT work until this is configured correctly.");
  console.error("Get a key from Google AI Studio: https://aistudio.google.com/app/apikey");
  console.error("********************************************************************************");
  // Attempt to initialize with a clearly invalid key if not set, so app doesn't crash on require
  // but SDK will likely fail operations. The routes already check if `model` is initialized.
  // Or, we could simply not initialize `model` here, and the checks in server.js would handle it.
  // For now, let's proceed with attempting initialization as the original code did,
  // which will lead to errors caught by the try-catch or by the SDK itself during calls.
}

try {
  // Pass GEMINI_API_KEY directly. If it's undefined or the placeholder,
  // GoogleGenerativeAI constructor or subsequent calls will likely fail,
  // which is the desired behavior if not configured.
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  if (GEMINI_API_KEY && GEMINI_API_KEY !== "YOUR_API_KEY_HERE") {
    console.log("Google Generative AI SDK initialized successfully.");
  }
} catch (error) {
  console.error("********************************************************************************");
  console.error("ERROR: Failed to initialize GoogleGenerativeAI. This is likely due to an invalid");
  console.error("or missing GEMINI_API_KEY. Please check your backend/.env file.");
  console.error("Underlying error:", error.message); // Log the actual error message from the SDK
  console.error("********************************************************************************");
  // model will remain undefined or not functional, and routes in server.js should handle this.
}

module.exports = { model };
