import { getApp } from 'firebase/app';
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  Schema,
} from 'firebase/ai';
import { parseWorkoutTextToParsedTemplate } from '../utils/exerciseParsing.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMAGE_PARSER_ENDPOINT = '/api/parse-workout-image';
const PARSER_NOT_CONFIGURED_MESSAGE = 'Image parser service is not configured.';

const WORKOUT_IMAGE_PROMPT = `You are a fitness app assistant. Analyze the workout plan image provided.
Extract all exercises with their sets, reps, and any notes from the image.
Look for workout session names or headings as the template name.
Return a JSON object matching the required schema exactly. Do not include markdown.
If you cannot detect a workout plan, return an empty exercises array.`;

// ---------------------------------------------------------------------------
// Mock data (dev only)
// ---------------------------------------------------------------------------

const mockParsedTemplate = {
  templateName: 'BUỔI 3: ANTERIOR B',
  exercises: [
    {
      exerciseName: 'Incline Dumbbell Press',
      muscleGroup: 'Chest',
      sets: '4',
      reps: '8-12',
      weight: '',
      notes: 'Ngực trên',
      confidence: 0.95,
    },
    {
      exerciseName: 'Flat Barbell Bench Press',
      muscleGroup: 'Chest',
      sets: '3',
      reps: '8-10',
      weight: '',
      notes: 'Ngực lớn',
      confidence: 0.95,
    },
    {
      exerciseName: 'Cable Pec Flyes',
      muscleGroup: 'Chest',
      sets: '3',
      reps: '12-15',
      weight: '',
      notes: 'Ép ngực ngang. Hoàn thành đủ 20 sets Ngực/tuần',
      confidence: 0.9,
    },
    {
      exerciseName: 'Bulgarian Split Squat',
      muscleGroup: 'Legs',
      sets: '3',
      reps: '10-12',
      weight: '',
      notes: 'Đùi trước/Mông',
      confidence: 0.9,
    },
    {
      exerciseName: 'Cable Lateral Raises',
      muscleGroup: 'Shoulders',
      sets: '4',
      reps: '12-15',
      weight: '',
      notes: 'Vai giữa',
      confidence: 0.9,
    },
    {
      exerciseName: 'Dumbbell Lateral Raises',
      muscleGroup: 'Shoulders',
      sets: '3',
      reps: '12-15',
      weight: '',
      notes: 'Vai giữa. Hoàn thành đủ 20 sets Vai/tuần khi tính cả vai sau ở buổi Posterior',
      confidence: 0.9,
    },
    {
      exerciseName: 'Hanging Leg Raises',
      muscleGroup: 'Core',
      sets: '3',
      reps: 'Max',
      weight: '',
      notes: 'Bụng',
      confidence: 0.9,
    },
  ],
  rawText: [
    'BUỔI 3: ANTERIOR B (Tập trung Ngực & Vai giữa)',
    'Incline Dumbbell Press (Ngực trên): 4 Sets x 8-12 Reps',
    'Flat Barbell Bench Press (Ngực lớn): 3 Sets x 8-10 Reps',
    'Cable Pec Flyes (Ép ngực ngang): 3 Sets x 12-15 Reps (Hoàn thành đủ 20 sets Ngực/tuần)',
    'Bulgarian Split Squat (Đùi trước/Mông): 3 Sets x 10-12 Reps/bên',
    'Cable Lateral Raises (Vai giữa): 4 Sets x 12-15 Reps',
    'Dumbbell Lateral Raises (Vai giữa): 3 Sets x 12-15 Reps (Hoàn thành đủ 20 sets Vai/tuần khi tính cả vai sau ở buổi Posterior)',
    'Hanging Leg Raises (Bụng): 3 Sets x Max Reps',
  ].join('\n'),
};

// ---------------------------------------------------------------------------
// Mock/dev helpers
// ---------------------------------------------------------------------------

const isMockParserEnabled = () => (
  import.meta.env.VITE_USE_MOCK_IMAGE_PARSER === 'true'
);

const getMockParsedTemplate = async () => {
  await new Promise(resolve => setTimeout(resolve, 650));
  return mockParsedTemplate;
};

// ---------------------------------------------------------------------------
// Dev-only: Vite local Swift OCR endpoint
// ---------------------------------------------------------------------------

const getParserEndpoints = () => {
  const endpoints = [IMAGE_PARSER_ENDPOINT];

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    const portSegment = port ? `:${port}` : '';

    endpoints.push(`${protocol}//${hostname}${portSegment}${IMAGE_PARSER_ENDPOINT}`);
    endpoints.push(`${protocol}//localhost${portSegment}${IMAGE_PARSER_ENDPOINT}`);
    endpoints.push(`${protocol}//[::1]${portSegment}${IMAGE_PARSER_ENDPOINT}`);
  }

  return [...new Set(endpoints)];
};

const parseEndpointResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    if (response.status === 404 || !contentType.includes('application/json')) {
      throw new Error(PARSER_NOT_CONFIGURED_MESSAGE);
    }

    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Could not detect a workout plan from this image. Try a clearer image or enter the template manually.');
  }

  if (!contentType.includes('application/json')) {
    throw new Error(PARSER_NOT_CONFIGURED_MESSAGE);
  }

  const parsed = await response.json();
  if (!Array.isArray(parsed.exercises)) {
    throw new Error('Could not detect a workout plan from this image. Try a clearer image or enter the template manually.');
  }

  return parsed;
};

const tryLocalEndpoint = async (imageBase64) => {
  const requestBody = JSON.stringify({ imageBase64 });
  let unavailableError = null;

  for (const endpoint of getParserEndpoints()) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });

      return await parseEndpointResponse(response);
    } catch (error) {
      const isUnavailable = (
        error.message === PARSER_NOT_CONFIGURED_MESSAGE ||
        error instanceof TypeError ||
        /failed to fetch|networkerror|load failed/i.test(error.message || '')
      );

      if (!isUnavailable) {
        throw error;
      }

      unavailableError = new Error(PARSER_NOT_CONFIGURED_MESSAGE);
    }
  }

  throw unavailableError || new Error(PARSER_NOT_CONFIGURED_MESSAGE);
};

// ---------------------------------------------------------------------------
// Gemini AI (Firebase AI Logic) — production path
// ---------------------------------------------------------------------------

const exerciseSchema = Schema.object({
  properties: {
    exerciseName: Schema.string(),
    muscleGroup: Schema.string(),
    sets: Schema.string(),
    reps: Schema.string(),
    weight: Schema.string(),
    notes: Schema.string(),
    confidence: Schema.number(),
  },
});

const workoutTemplateSchema = Schema.object({
  properties: {
    templateName: Schema.string(),
    exercises: Schema.array({ items: exerciseSchema }),
    rawText: Schema.string(),
  },
});

let geminiTemplateModel = null;

const getGeminiTemplateModel = () => {
  if (geminiTemplateModel) return geminiTemplateModel;

  const ai = getAI(getApp(), { backend: new GoogleAIBackend() });
  geminiTemplateModel = getGenerativeModel(ai, {
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: workoutTemplateSchema,
      temperature: 0.1,
    },
  });

  return geminiTemplateModel;
};

const getGeminiParserError = (error) => {
  const code = String(error?.code || '').toLowerCase();
  const status = Number(error?.customErrorData?.status);
  const message = String(error?.message || '').toLowerCase();

  if (code.includes('api-not-enabled') || message.includes('api is not enabled')) {
    return new Error('Workout image parsing needs Firebase AI Logic enabled for this project.');
  }

  if (status === 429 || code.includes('quota')) {
    return new Error('Image parsing is temporarily at its usage limit. Please try again shortly.');
  }

  if (status === 401 || status === 403) {
    return new Error('Firebase AI could not authorize this request. Check AI Logic and App Check settings.');
  }

  if (code.includes('fetch-error') || code.includes('network')) {
    return new Error('Could not reach the image parsing service. Check your connection and try again.');
  }

  return new Error(error?.message || 'Could not detect a workout plan from this image. Try a clearer image or enter the template manually.');
};

const parseWithGemini = async (imageBase64, mimeType = 'image/jpeg') => {
  try {
    const model = getGeminiTemplateModel();
    const result = await model.generateContent([
      WORKOUT_IMAGE_PROMPT,
      {
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      },
    ]);

    const rawJson = result.response.text();
    let parsed;
    try {
      parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    } catch {
      throw new Error('The AI returned invalid JSON. Please try again.');
    }

    if (!Array.isArray(parsed?.exercises) || parsed.exercises.length === 0) {
      // Fallback: try parsing rawText if Gemini returned it but no structured exercises
      if (parsed?.rawText) {
        const fromText = parseWorkoutTextToParsedTemplate(parsed.rawText);
        if (fromText.exercises.length > 0) return fromText;
      }
      throw new Error('Could not detect a workout plan from this image. Try a clearer image or enter the template manually.');
    }

    return {
      templateName: parsed.templateName || 'Imported Workout Template',
      exercises: parsed.exercises,
      rawText: parsed.rawText || '',
    };
  } catch (error) {
    throw getGeminiParserError(error);
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const parseWorkoutTemplateImage = async (imageBase64, mimeType = 'image/jpeg') => {
  if (!imageBase64) {
    throw new Error('Please upload an image before parsing.');
  }

  // 1. Mock mode (dev shortcut)
  if (isMockParserEnabled()) {
    return getMockParsedTemplate();
  }

  // 2. In dev, try the local Swift OCR Vite endpoint first.
  //    Fall through to Gemini for ANY local endpoint failure:
  //    - Server unavailable / network error (404, TypeError, fetch failed)
  //    - Swift OCR couldn't read the image (500 OCR error)
  //    Only a definitive "no workout detected" (422) is propagated directly.
  if (import.meta.env.DEV) {
    try {
      return await tryLocalEndpoint(imageBase64);
    } catch (error) {
      const isDefinitiveFailure = /could not detect a workout plan/i.test(error.message || '');
      if (isDefinitiveFailure) throw error;
      // Any other error (OCR read failure, network, 404) → fall through to Gemini
    }
  }

  // 3. Production (or dev fallback): use Gemini AI
  return parseWithGemini(imageBase64, mimeType);
};
