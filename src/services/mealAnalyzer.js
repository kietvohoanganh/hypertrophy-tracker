import { getApp } from 'firebase/app';
import {
  getAI,
  getGenerativeModel,
  VertexAIBackend,
} from 'firebase/ai';
import { estimateMealDescriptionLocally } from './localMealEstimator.js';

const IMAGE_ANALYSIS_PROMPT =
  'Analyze the food in this image. Estimate ingredients, portion size, calories, protein, carbs, and fat. Return JSON only. Do not include markdown. If uncertain, lower the confidence and explain in notes.';

const DESCRIPTION_ANALYSIS_PROMPT =
  'Analyze this meal description. Estimate calories, protein, carbs, and fat for each food item and the total meal. Return JSON only. Do not include markdown. If portion size is missing, make a reasonable estimate and mark confidence lower.';

const DEFAULT_ERROR_MESSAGE = 'AI meal analysis failed. Please try again.';

const clampNumber = (value, min = 0, max = Number.POSITIVE_INFINITY) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return min;
  return Math.min(max, Math.max(min, parsedValue));
};

const cleanString = (value, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmedValue = value.trim();
  return trimmedValue || fallback;
};

const parseJsonPayload = (payload) => {
  if (payload && typeof payload === 'object') return payload;
  if (typeof payload !== 'string') {
    throw new Error('The AI returned an invalid meal response. Please try again.');
  }

  const trimmedPayload = payload
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return JSON.parse(trimmedPayload);
  } catch {
    throw new Error('The AI returned invalid JSON. Please try the analysis again.');
  }
};

const unwrapAnalysisPayload = (payload) => {
  const parsedPayload = parseJsonPayload(payload);
  const wrappedPayload =
    parsedPayload.result ??
    parsedPayload.analysis ??
    parsedPayload.data ??
    parsedPayload.meal;

  return wrappedPayload === undefined ? parsedPayload : parseJsonPayload(wrappedPayload);
};

const normalizeItem = (item, index) => ({
  name: cleanString(item?.name, `Meal item ${index + 1}`),
  estimatedGrams: clampNumber(item?.estimatedGrams),
  kcal: clampNumber(item?.kcal),
  protein: clampNumber(item?.protein),
  carbs: clampNumber(item?.carbs),
  fat: clampNumber(item?.fat),
  confidence: clampNumber(item?.confidence, 0, 1),
});

export const normalizeMealAnalysis = (payload) => {
  const meal = unwrapAnalysisPayload(payload);

  if (!meal || typeof meal !== 'object' || Array.isArray(meal)) {
    throw new Error('The AI returned an invalid meal response. Please try again.');
  }

  const items = Array.isArray(meal.items)
    ? meal.items.filter(item => item && typeof item === 'object').map(normalizeItem)
    : [];

  if (items.length === 0) {
    throw new Error('No food items were detected. Try a clearer photo or add more detail.');
  }

  return {
    mealName: cleanString(meal.mealName, 'AI Meal'),
    totalKcal: clampNumber(meal.totalKcal),
    totalProtein: clampNumber(meal.totalProtein),
    totalCarbs: clampNumber(meal.totalCarbs),
    totalFat: clampNumber(meal.totalFat),
    confidence: clampNumber(meal.confidence, 0, 1),
    items,
    notes: cleanString(
      meal.notes,
      'Portions are estimated. Please review each item before saving.',
    ),
  };
};

let _firebaseMealModel = null;

const getFirebaseMealModel = () => {
  if (_firebaseMealModel) return _firebaseMealModel;
  const ai = getAI(getApp(), { backend: new VertexAIBackend() });
  _firebaseMealModel = getGenerativeModel(ai, {
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });
  return _firebaseMealModel;
};

const getMealAnalysisError = (error) => {
  const code = String(error?.code || '').toLowerCase();
  const status = Number(error?.customErrorData?.status);
  const message = String(error?.message || '').toLowerCase();

  if (code.includes('api-not-enabled') || message.includes('api is not enabled')) {
    return new Error('Meal analysis needs Vertex AI enabled for this Firebase project.');
  }

  if (status === 429 || code.includes('quota')) {
    return new Error('Meal analysis is temporarily at its usage limit. Please try again shortly.');
  }

  if (status === 401 || status === 403) {
    return new Error('Firebase AI could not authorize this request. Make sure Vertex AI API is enabled in your Google Cloud project.');
  }

  if (code.includes('fetch-error') || code.includes('network')) {
    return new Error('Could not reach the meal analysis service. Check your connection and try again.');
  }

  return new Error(cleanString(error?.message, DEFAULT_ERROR_MESSAGE));
};

const generateMealAnalysis = async (content) => {
  try {
    const result = await getFirebaseMealModel().generateContent(content);
    return normalizeMealAnalysis(result.response.text());
  } catch (error) {
    throw getMealAnalysisError(error);
  }
};

export const analyzeMealImage = async (imageBase64, mimeType = 'image/jpeg') => {
  if (!cleanString(imageBase64)) {
    throw new Error('Choose a meal photo before analyzing.');
  }

  return generateMealAnalysis([
    IMAGE_ANALYSIS_PROMPT,
    {
      inlineData: {
        data: imageBase64,
        mimeType: cleanString(mimeType, 'image/jpeg'),
      },
    },
  ]);
};

export const analyzeMealDescription = async (description) => {
  const cleanDescription = cleanString(description);
  if (!cleanDescription) {
    throw new Error('Describe your meal before analyzing.');
  }

  try {
    return await generateMealAnalysis(
      `${DESCRIPTION_ANALYSIS_PROMPT}\n\nMeal description: ${cleanDescription}`,
    );
  } catch {
    return normalizeMealAnalysis(estimateMealDescriptionLocally(cleanDescription));
  }
};
