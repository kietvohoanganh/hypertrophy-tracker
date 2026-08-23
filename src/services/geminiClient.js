/**
 * geminiClient.js
 * Direct Gemini API client — no Firebase AI Logic dependency.
 * Reads the API key from VITE_GEMINI_API_KEY at build time.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let _client = null;

/**
 * Returns a singleton GoogleGenerativeAI instance.
 * Throws a descriptive error if the API key is missing.
 */
export const getGeminiClient = () => {
  if (_client) return _client;

  if (!GEMINI_API_KEY) {
    throw new Error(
      'Gemini API key is not configured. Add VITE_GEMINI_API_KEY to your .env file.',
    );
  }

  _client = new GoogleGenerativeAI(GEMINI_API_KEY);
  return _client;
};

/**
 * Returns a generative model instance.
 * @param {string} modelName - e.g. 'gemini-2.0-flash'
 * @param {object} generationConfig - optional generation config
 */
export const getGeminiModel = (modelName = 'gemini-2.0-flash', generationConfig = {}) => {
  const client = getGeminiClient();
  return client.getGenerativeModel({ model: modelName, generationConfig });
};
