import { memo, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getFirestore, collection, query, orderBy, limit, onSnapshot, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc } from "firebase/firestore";
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ExercisePicker from './components/ExercisePicker';
import FitnessIcon from './components/FitnessIcon';
import { AppHeader, BrandLockup, EmptyState, PageHeader, PrimaryNavigation } from './components/AppShell';
import WorkoutMotion from './components/WorkoutMotion';
import heroArtwork from './assets/hero.png';
import {
  convertTemplateToActiveWorkout,
  createDefaultTemplateSet,
  normalizeTemplateExercise,
  validateTemplate,
} from './utils/templates';
import { getBestSetForExercise, getExerciseHistory } from './utils/exercises';
import {
  detectNewExercises,
  findExerciseLibraryMatch,
  mapParsedExerciseToTemplateExercise,
} from './utils/exerciseParsing';
import { analyzeMealDescription, analyzeMealImage } from './services/mealAnalyzer';
import { parseWorkoutTemplateImage } from './services/templateImageParser';

// 1. YOUR FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyCSC7lIl3aBkzu4q9KoJep6YVAxGThO1AI",
  authDomain: "hypertrophy-tracker-a14a5.firebaseapp.com",
  projectId: "hypertrophy-tracker-a14a5",
  storageBucket: "hypertrophy-tracker-a14a5.firebasestorage.app",
  messagingSenderId: "230361153449",
  appId: "1:230361153449:web:a8b9b991005569a0754eb8",
  measurementId: "G-JBYZJ82X26"
};

const AUTH_LOADING_TIMEOUT_MS = 4000;

let auth = null;
let db = null;

try {
  const app = initializeApp(firebaseConfig);

  try {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: undefined,
    });
    console.info("Firebase Auth initialized with persistent storage.");
  } catch (authError) {
    if (authError?.code !== 'auth/already-initialized') throw authError;
    console.info("Firebase Auth was already initialized; using existing Auth instance.");
    auth = getAuth(app);
  }

  db = getFirestore(app);
} catch (error) {
  console.error("Firebase Auth initialization failed:", error);
  auth = null;
  db = null;
}

const THEME = {
  primaryRed: '#FF6B45',
  primaryRedHover: '#FF805F',
  bgBlack: '#0A0C0E',
  bgDark: '#15181C',
  cardBg: 'rgba(24, 27, 31, 0.94)',
  border: 'rgba(245, 242, 235, 0.12)',
  textPrimary: '#F7F5EF',
  textSecondary: '#A4A8B0',
  accentGold: '#D8F36A',
  successGreen: '#69D7A0',
  dangerRed: '#FF6A68',
  redSoft: 'rgba(255, 107, 69, 0.13)',
  redMedium: 'rgba(255, 107, 69, 0.28)',
  goldSoft: 'rgba(216, 243, 106, 0.12)',
  successSoft: 'rgba(105, 215, 160, 0.13)',
  dangerSoft: 'rgba(255, 106, 104, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.72)',
  shadow: '0 22px 58px rgba(0, 0, 0, 0.46)',
  macroCarbs: '#9BB7FF',
};

// 2. EXERCISE DATABASE
const EXERCISE_DATABASE = {
  "Chest": ["Bench Press", "Incline Dumbbell Press", "Cable Crossovers", "Dips", "Low Incline Dumbbell Press", "Flat Dumbbell Fly", "Deficit Push-up"],
  "Back": ["Barbell Deadlift", "Pull-ups", "Lat Pulldowns", "Barbell Row", "Lat Prayer", "Deficit Barbell Row"],
  "Shoulders": ["Overhead Press", "Lateral Raises", "Arnold Press", "Face Pulls", "Seated Lateral Raise", "Super ROM Lateral Raise"],
  "Legs": ["Barbell Squat", "High Bar Squat", "Front Squat", "Goblet Squat", "Hack Squat", "Leg Press", "Reverse Nordic", "Sissy Squat", "Leg Extensions", "Bulgarian Split Squat", "Front Foot Elevated Smith Lunge", "Seated Machine Adductor", "Romanian Deadlift (RDL)", "Stiff Legged Deadlift", "Single-Leg RDL", "Good Mornings", "Seated/Lying Leg Curl", "Glute-Ham Raise (GHR)", "Nordic Hamstring Curl", "Glute Thrust Machine", "Barbell Hip Thrust", "Sit Back Squat", "Deficit Reverse Lunge", "Cable Glute Kickbacks", "Weighted Step-Ups", "Seated Machine Abductor", "Calf Raises", "Standing Calf Raise", "Seated Calf Raise", "Tibialis Raise"],
  "Arms": ["Bicep Curls", "Triceps Pushdown", "Skull Crushers", "Hammer Curls", "Overhead Extension", "Dip Machine", "Decline Dumbbell Curl", "Incline Dumbbell Curl", "Superman Cable Curl"],
  "Core": ["Hanging Leg Raises", "Cable Crunches", "Plank"]
};

const MUSCLE_GROUP_OPTIONS = ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core', 'Other'];
const MAX_TEMPLATE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_MEAL_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const FIREBASE_AI_SETUP_URL =
  'https://console.firebase.google.com/project/hypertrophy-tracker-a14a5/ailogic/';
const MAIN_NAV_ITEMS = [
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'tdee', label: 'TDEE', icon: 'tdee' },
  { id: 'workout', label: 'Workout', icon: 'workout', isPrimary: true },
  { id: 'food', label: 'Nutrition', icon: 'nutrition' },
  { id: 'you', label: 'Profile', icon: 'profile' },
];
const CHART_HEIGHT = 260;

const clampNutritionValue = (value) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;
};

const roundNutritionValue = (value) => Math.round(clampNutritionValue(value) * 10) / 10;

const getInitialActiveTab = () => {
  if (typeof window === 'undefined') return 'workout';
  return localStorage.getItem('eliteTrackerTab') || 'workout';
};

const createDefaultExerciseId = (muscleGroup, exerciseName) => {
  const slug = `${muscleGroup}-${exerciseName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `default-${slug}`;
};

const createImportedExerciseId = (muscleGroup, exerciseName) => {
  const slug = `${muscleGroup}-${exerciseName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `import-${slug || 'exercise'}`;
};

const getUniformSetValue = (sets = [], field) => {
  if (sets.length === 0) return '';

  const firstValue = String(sets[0]?.[field] ?? '');
  const allMatch = sets.every(set => String(set?.[field] ?? '') === firstValue);
  return allMatch ? firstValue : '';
};

const formatHistoryMetric = (value) => {
  if (value === undefined || value === null || value === '') return '—';

  const number = Number(value);
  if (!Number.isFinite(number)) return String(value).trim() || '—';
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2)));
};

const isValidImportedExercise = (exercise = {}) => {
  const setCount = Number.parseInt(exercise.setCount, 10);
  return Boolean(
    String(exercise.exerciseName || '').trim() &&
    String(exercise.muscleGroup || '').trim() &&
    Number.isFinite(setCount) &&
    setCount > 0
  );
};

const getConfidenceLabel = (confidence = 0) => {
  const value = Number(confidence);
  if (value >= 0.85) return 'High';
  if (value >= 0.65) return 'Medium';
  return 'Low';
};

const dedupeById = (items = []) => (
  Array.from(new Map(items.map(item => [item.id, item])).values())
);

const sortByUpdatedAtDesc = (items = []) => (
  [...items].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
);

const getElapsedSeconds = (startedAt) => (
  startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0
);

const formatTime = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const TimerDisplay = memo(function TimerDisplay({ startedAt, style }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => getElapsedSeconds(startedAt));

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setElapsedSeconds(getElapsedSeconds(startedAt));
    }, 0);
    if (!startedAt) return () => window.clearTimeout(syncTimer);

    const intervalId = window.setInterval(() => {
      setElapsedSeconds(getElapsedSeconds(startedAt));
    }, 1000);

    return () => {
      window.clearTimeout(syncTimer);
      window.clearInterval(intervalId);
    };
  }, [startedAt]);

  return <p className="workout-timer" style={style}>{formatTime(elapsedSeconds)}</p>;
});

const WorkoutExerciseBlock = memo(function WorkoutExerciseBlock({
  exercise,
  sets,
  previous,
  onAddSet,
  onToggleSetCompletion,
  onUpdateSet,
}) {
  return (
    <div className="exercise-card" style={styles.exerciseBlock}>
      <div style={styles.exerciseHeader}><h3 style={styles.exerciseName}>{exercise}</h3></div>
      <div style={styles.tableHeader}>
        <span style={styles.setCol}>Set</span>
        <span style={styles.prevCol}>Prev</span>
        <span style={styles.inputColTitle}>kg</span>
        <span style={styles.inputColTitle}>Reps</span>
        <span style={styles.checkCol} aria-label="Completed"><FitnessIcon name="check" size={16} /></span>
      </div>
      {sets.map((set, idx) => (
        <div className={set.completed ? 'completed-set' : ''} key={idx} style={{
          ...styles.setRow,
          backgroundColor: set.completed ? THEME.successSoft : 'transparent',
          borderColor: set.completed ? 'rgba(52, 199, 89, 0.38)' : 'transparent'
        }}>
          <span style={styles.setCol}>{idx + 1}</span>
          <span style={styles.prevCol}>{previous || "—"}</span>
          <div style={styles.inputCol}>
            <input
              type="number"
              step="0.1"
              placeholder="0"
              value={set.weight}
              onChange={(e) => onUpdateSet(exercise, idx, 'weight', e.target.value)}
              style={styles.inputField}
            />
          </div>
          <div style={styles.inputCol}>
            <input
              type="number"
              placeholder="0"
              value={set.reps}
              onChange={(e) => onUpdateSet(exercise, idx, 'reps', e.target.value)}
              style={styles.inputField}
            />
          </div>
          <div style={styles.checkCol}>
            <button
              type="button"
              className="mu-icon-button"
              onClick={() => onToggleSetCompletion(exercise, idx)}
              style={{
                ...styles.checkButton,
                backgroundColor: set.completed ? THEME.successGreen : THEME.bgDark,
                color: set.completed ? THEME.bgBlack : THEME.textSecondary,
                borderColor: set.completed ? THEME.successGreen : THEME.border
              }}
            >
              {set.completed && <FitnessIcon name="check" size={17} />}
            </button>
          </div>
        </div>
      ))}
      <div style={{textAlign: 'center', marginTop: '10px'}}>
        <button type="button" className="add-set-button" onClick={() => onAddSet(exercise)} style={styles.addSetText}>
          <FitnessIcon name="plus" size={17} /> Add set
        </button>
      </div>
    </div>
  );
});

export default function App() {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authStartupSlow, setAuthStartupSlow] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  // --- TAB PERSISTENCE STATE ---
  const [activeTab, setActiveTab] = useState(getInitialActiveTab);

  useEffect(() => {
    localStorage.setItem('eliteTrackerTab', activeTab);
  }, [activeTab]);

  // --- FAVORITE EXERCISES STATE ---
  // --- FAVORITE EXERCISES STATE (FIREBASE SYNCED) ---
  const [favoriteExercises, setFavoriteExercises] = useState([]);
  const [customExercises, setCustomExercises] = useState([]);
  const [workoutTemplates, setWorkoutTemplates] = useState([]);
  const [templatesError, setTemplatesError] = useState('');

  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [selectedExerciseHistoryName, setSelectedExerciseHistoryName] = useState('');
  const [selectedDate, setSelectedDate] = useState(null); 
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeWorkout, setActiveWorkout] = useState({});
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showCreateExerciseModal, setShowCreateExerciseModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showImportTemplateModal, setShowImportTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateNotes, setTemplateNotes] = useState('');
  const [templateExercises, setTemplateExercises] = useState([]);
  const [templateExerciseSearch, setTemplateExerciseSearch] = useState('');
  const [templateFormError, setTemplateFormError] = useState('');
  const [importImagePreview, setImportImagePreview] = useState('');
  const [importImageBase64, setImportImageBase64] = useState('');
  const [importImageMimeType, setImportImageMimeType] = useState('image/jpeg');
  const [importImageFileName, setImportImageFileName] = useState('');
  const [isParsingTemplateImage, setIsParsingTemplateImage] = useState(false);
  const [hasParsedImport, setHasParsedImport] = useState(false);
  const [importTemplateError, setImportTemplateError] = useState('');
  const [importedTemplateName, setImportedTemplateName] = useState('');
  const [importedTemplateExercises, setImportedTemplateExercises] = useState([]);
  const [importRawText, setImportRawText] = useState('');
  const [importExerciseSearch, setImportExerciseSearch] = useState('');
  const importParseRequestIdRef = useRef(0);
  const isSavingCustomExerciseRef = useRef(false);
  const isSavingTemplateRef = useRef(false);
  const templateDragIndexRef = useRef(null);
  const isSavingImportedTemplateRef = useRef(false);
  const [currentTemplateId, setCurrentTemplateId] = useState(null);
  const [currentTemplateName, setCurrentTemplateName] = useState('');
  const workoutStartedAtRef = useRef(null);
  const [workoutStartedAt, setWorkoutStartedAt] = useState(null);
  
  // COACHING MODULE STATES
  const [profileAge, setProfileAge] = useState(20);
  const [profileWeight, setProfileWeight] = useState(70);
  const [profileHeight, setProfileHeight] = useState(170);
  const [profileGender, setProfileGender] = useState('male');
  const [profileActivity, setProfileActivity] = useState(1.2);
  const [profileGoal, setProfileGoal] = useState('maintain');
  const [targetMacros, setTargetMacros] = useState(null);
  
  // DYNAMIC TDEE STATES 
  const [dailyWeight, setDailyWeight] = useState('');
  const [dailyLogs, setDailyLogs] = useState([]);
  const [dynamicTDEE, setDynamicTDEE] = useState(null);
  const [chartReady, setChartReady] = useState(false);
  const [chartSize, setChartSize] = useState({ width: 0, height: CHART_HEIGHT });
  const chartFrameRef = useRef(null);

  const calculateDynamicTDEE = (logs, windowSize = 14) => {
    const windowLogs = logs.slice(0, windowSize);
    const N = windowLogs.length;
    
    if (N < 7) return; 

    const totalCalories = windowLogs.reduce((sum, log) => sum + log.calories, 0);
    const newestWeight = windowLogs[0].weight;
    const oldestWeight = windowLogs[N - 1].weight;
    const deltaW = newestWeight - oldestWeight; 

    const calculatedTDEE = (totalCalories - (deltaW * 7700)) / N;
    setDynamicTDEE(Math.round(calculatedTDEE));
  };
  
  // AI NUTRITION STATES
  const [aiMealInputMode, setAiMealInputMode] = useState('');
  const [mealPhotoPreview, setMealPhotoPreview] = useState('');
  const [mealPhotoBase64, setMealPhotoBase64] = useState('');
  const [mealPhotoMimeType, setMealPhotoMimeType] = useState('image/jpeg');
  const [isAnalyzingMealPhoto, setIsAnalyzingMealPhoto] = useState(false);
  const [mealPhotoError, setMealPhotoError] = useState('');
  const [mealDescriptionInput, setMealDescriptionInput] = useState('');
  const [isAnalyzingMealDescription, setIsAnalyzingMealDescription] = useState(false);
  const [aiMealResult, setAiMealResult] = useState(null);
  const [aiMealReviewItems, setAiMealReviewItems] = useState([]);
  const [aiMealError, setAiMealError] = useState('');
  const [isSavingAiMeal, setIsSavingAiMeal] = useState(false);
  const mealPhotoInputRef = useRef(null);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseMuscleGroup, setNewExerciseMuscleGroup] = useState('');
  const [newExerciseNotes, setNewExerciseNotes] = useState('');
  const [createExerciseError, setCreateExerciseError] = useState('');
  const [createExerciseContext, setCreateExerciseContext] = useState('workout');
  const [lastCreatedExerciseId, setLastCreatedExerciseId] = useState('');
  const [isSavingCustomExercise, setIsSavingCustomExercise] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isSavingImportedTemplate, setIsSavingImportedTemplate] = useState(false);
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);
  const contentScrollRef = useRef(null);
  const previousScrollTopRef = useRef(0);

  const isAnyModalOpen = Boolean(
    showExerciseModal ||
    showCreateExerciseModal ||
    showTemplateModal ||
    showImportTemplateModal ||
    selectedExerciseHistoryName
  );

  const shouldLoadExerciseLibrary = Boolean(
    user &&
    activeTab === 'workout' &&
    (showExerciseModal || showCreateExerciseModal || showTemplateModal || showImportTemplateModal)
  );
  const visibleTab = activeTab;
  const isTdeeTabVisible = visibleTab === 'tdee';

  useEffect(() => {
    if (!isAnyModalOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      const activeDialog = dialogs[dialogs.length - 1];
      activeDialog?.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
    });

    const keepFocusInsideDialog = (event) => {
      if (event.key !== 'Tab') return;
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      const activeDialog = dialogs[dialogs.length - 1];
      if (!activeDialog) return;

      const focusable = [...activeDialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', keepFocusInsideDialog);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keepFocusInsideDialog);
      previouslyFocused?.focus?.();
    };
  }, [isAnyModalOpen, selectedExerciseHistoryName, showCreateExerciseModal, showExerciseModal, showImportTemplateModal, showTemplateModal]);

  useEffect(() => {
    if (!user || activeTab !== 'workout') return undefined;

    let isCancelled = false;

    const loadWorkoutTemplates = async () => {
      try {
        const templatesQuery = query(collection(db, "users", user.uid, "workout_templates"), orderBy("updatedAt", "desc"));
        const snapshot = await getDocs(templatesQuery);
        if (isCancelled) return;

        const templatesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setWorkoutTemplates(sortByUpdatedAtDesc(dedupeById(templatesData)));
        setTemplatesError('');
      } catch (error) {
        if (!isCancelled) {
          console.error("Workout templates could not be loaded:", error);
          setTemplatesError('Templates could not be loaded right now.');
        }
      }
    };

    loadWorkoutTemplates();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, user]);

  useEffect(() => {
    if (!shouldLoadExerciseLibrary) return undefined;

    let isCancelled = false;

    const loadFavoriteExercises = async () => {
      try {
        const prefsRef = doc(db, "users", user.uid, "preferences", "exercises");
        const docSnap = await getDoc(prefsRef);
        if (isCancelled) return;

        setFavoriteExercises(docSnap.exists() ? docSnap.data().favorites || [] : []);
      } catch (error) {
        if (!isCancelled) {
          console.error("Favorite exercises could not be loaded:", error);
          setFavoriteExercises([]);
        }
      }
    };

    loadFavoriteExercises();

    return () => {
      isCancelled = true;
    };
  }, [shouldLoadExerciseLibrary, user]);

  useEffect(() => {
    if (!shouldLoadExerciseLibrary) return undefined;

    let isCancelled = false;

    const loadCustomExercises = async () => {
      try {
        const customExercisesRef = collection(db, "users", user.uid, "custom_exercises");
        const snapshot = await getDocs(customExercisesRef);
        if (isCancelled) return;

        const exercisesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCustomExercises(dedupeById(exercisesData));
      } catch (error) {
        if (!isCancelled) {
          console.error("Custom exercises could not be loaded:", error);
        }
      }
    };

    loadCustomExercises();

    return () => {
      isCancelled = true;
    };
  }, [shouldLoadExerciseLibrary, user]);

  const prevData = useMemo(() => {
    if (!isWorkoutActive || workoutHistory.length === 0) return {};

    const activeExercises = Object.keys(activeWorkout);
    const newPrevData = {};

    activeExercises.forEach(exName => {
      const lastWorkoutWithEx = workoutHistory.find(h => h.data && h.data[exName]);
      if (lastWorkoutWithEx) {
        const lastSets = lastWorkoutWithEx.data[exName];
        const bestSet = lastSets.reduce((prev, current) => (parseFloat(prev.weight) > parseFloat(current.weight)) ? prev : current);
        newPrevData[exName] = `${bestSet.weight}kg x ${bestSet.reps}`;
      }
    });

    return newPrevData;
  }, [activeWorkout, isWorkoutActive, workoutHistory]); 

  const allExerciseLibrary = useMemo(() => {
    const library = [];
    const seenExercises = new Set();

    Object.entries(EXERCISE_DATABASE).forEach(([muscleGroup, exercises]) => {
      exercises.forEach(exerciseName => {
        const key = `${muscleGroup}|${exerciseName.toLowerCase()}`;
        if (seenExercises.has(key)) return;

        seenExercises.add(key);
        library.push({
          exerciseId: createDefaultExerciseId(muscleGroup, exerciseName),
          exerciseName,
          muscleGroup,
          isCustom: false,
        });
      });
    });

    customExercises.forEach(exercise => {
      const exerciseName = (exercise.name || '').trim();
      if (!exerciseName) return;

      const rawMuscleGroup = exercise.muscleGroup || exercise.category || 'Other';
      const muscleGroup = rawMuscleGroup === 'Custom' ? 'Other' : rawMuscleGroup;
      const key = `${muscleGroup}|${exerciseName.toLowerCase()}`;
      if (seenExercises.has(key)) return;

      seenExercises.add(key);
      library.push({
        exerciseId: exercise.id || `custom-${exerciseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        exerciseName,
        muscleGroup,
        isCustom: true,
      });
    });

    return library;
  }, [customExercises]);

  const selectedExerciseHistory = useMemo(() => (
    getExerciseHistory(workoutHistory, selectedExerciseHistoryName)
  ), [workoutHistory, selectedExerciseHistoryName]);

  const selectedExerciseBestSet = useMemo(() => (
    getBestSetForExercise(selectedExerciseHistory)
  ), [selectedExerciseHistory]);

  const canSaveImportedTemplate = useMemo(() => (
    importedTemplateName.trim() &&
    importedTemplateExercises.length > 0 &&
    importedTemplateExercises.every(isValidImportedExercise)
  ), [importedTemplateExercises, importedTemplateName]);

  // --- USE EFFECTS ---
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return undefined;

    const handleWindowError = (event) => {
      console.error("Window runtime error:", event.error || event.message);
    };

    const handleUnhandledRejection = (event) => {
      console.error("Unhandled promise rejection:", event.reason);
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    let unsubscribe = null;

    const finishAuthLoading = (currentUser = null) => {
      if (!isActive) return;
      setAuthStartupSlow(false);
      setUser(currentUser);
      setAuthLoading(false);
    };

    const timeoutId = window.setTimeout(() => {
      if (!isActive) return;
      console.info(`Firebase Auth is still loading after ${AUTH_LOADING_TIMEOUT_MS / 1000} seconds.`);
      setAuthStartupSlow(true);
    }, AUTH_LOADING_TIMEOUT_MS);

    if (!auth) {
      window.clearTimeout(timeoutId);
      console.error("Firebase Auth is unavailable. Showing login screen.");
      finishAuthLoading(null);
      return () => {
        isActive = false;
        window.clearTimeout(timeoutId);
      };
    }

    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (currentUser) => {
          window.clearTimeout(timeoutId);
          console.info(`Firebase Auth state resolved; ${currentUser ? 'user session found' : 'no user session'}.`);
          finishAuthLoading(currentUser);
        },
        (error) => {
          window.clearTimeout(timeoutId);
          console.error("Firebase Auth state error:", error);
          finishAuthLoading(null);
        }
      );
    } catch (error) {
      window.clearTimeout(timeoutId);
      console.error("Firebase Auth state listener initialization failed:", error);
      finishAuthLoading(null);
    }

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  useEffect(() => {
    const shouldLoadDailyLogs = user && ['tdee', 'food', 'you'].includes(activeTab);
    if (!shouldLoadDailyLogs) return undefined;

    const logsQuery = query(collection(db, "users", user.uid, "daily_logs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(
      logsQuery,
      (snapshot) => {
        const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDailyLogs(logsData);
        if (logsData.length >= 7) {
          calculateDynamicTDEE(logsData);
        } else {
          setDynamicTDEE(null);
        }
      },
      (error) => {
        console.error("Daily logs listener failed:", error);
      }
    );

    return () => unsubscribe();
  }, [activeTab, user]);

  useEffect(() => {
    const shouldLoadHistory = user && (activeTab === 'history' || isWorkoutActive);
    if (!shouldLoadHistory) return undefined;

    const historyQuery = query(collection(db, "users", user.uid, "history"), orderBy("timestamp", "desc"), limit(50));
    const unsubscribe = onSnapshot(
      historyQuery,
      (snapshot) => {
        const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setWorkoutHistory(historyData);
      },
      (error) => {
        console.error("Workout history listener failed:", error);
      }
    );

    return () => unsubscribe();
  }, [activeTab, isWorkoutActive, user]);

  const handleContentScroll = useCallback((event) => {
    const nextScrollTop = event.currentTarget.scrollTop;
    const previousScrollTop = previousScrollTopRef.current;
    const delta = nextScrollTop - previousScrollTop;

    if (nextScrollTop <= 20) {
      setIsBottomNavVisible(true);
    } else if (delta > 10 && nextScrollTop > 80) {
      setIsBottomNavVisible(false);
    } else if (delta < -8) {
      setIsBottomNavVisible(true);
    }

    previousScrollTopRef.current = nextScrollTop;
  }, []);

  const handleTabSelect = useCallback((nextTab) => {
    if (nextTab === activeTab) return;
    setIsBottomNavVisible(true);
    previousScrollTopRef.current = 0;
    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    setActiveTab(nextTab);
  }, [activeTab]);

  const getWorkoutDurationSeconds = useCallback(() => (
    getElapsedSeconds(workoutStartedAtRef.current)
  ), []);

  // --- HELPER FUNCTIONS ---
  const getTodayDocId = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const toggleFavorite = async (e, exerciseName) => {
    e.stopPropagation();
    if (!user) return;

    // Xác định trạng thái mới của danh sách yêu thích
    const isCurrentlyFav = favoriteExercises.includes(exerciseName);
    const newFavorites = isCurrentlyFav 
      ? favoriteExercises.filter(ex => ex !== exerciseName)
      : [...favoriteExercises, exerciseName];

    // Cập nhật lên Firebase Firestore
    setFavoriteExercises(newFavorites);
    try {
      const prefsRef = doc(db, "users", user.uid, "preferences", "exercises");
      await setDoc(prefsRef, {
        favorites: newFavorites
      }, { merge: true }); // Dùng merge để không ghi đè mất các preferences khác nếu có sau này
    } catch (error) {
      setFavoriteExercises(favoriteExercises);
      alert("Error syncing favorites: " + error.message);
    }
  };
  
  const calculateCoachingMacros = () => {
    if (!profileWeight) return alert("Please enter your weight to calculate macros!");
    const weight = parseFloat(profileWeight);
    const height = parseFloat(profileHeight);
    const age = parseInt(profileAge);

    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += profileGender === 'male' ? 5 : -161;

    let targetTDEE = bmr * parseFloat(profileActivity);

    if (profileGoal === 'cut') targetTDEE -= 500; 
    if (profileGoal === 'bulk') targetTDEE += 300; 

    targetTDEE = Math.round(targetTDEE);

    const protein = Math.round(weight * 2.2);
    const fat = Math.round(weight * 1.0);
    const remainingKcal = targetTDEE - (protein * 4) - (fat * 9);
    const carbs = remainingKcal > 0 ? Math.round(remainingKcal / 4) : 0;

    setTargetMacros({ kcal: targetTDEE, protein, fat, carbs });
  };

  const weightTrendData = useMemo(() => {
    if (!isTdeeTabVisible || dailyLogs.length < 2) return [];

    const chronologicalLogs = [...dailyLogs]
      .reverse()
      .map(log => ({
        log,
        weight: parseFloat(log.weight),
      }))
      .filter(({ weight }) => Number.isFinite(weight));

    if (chronologicalLogs.length < 2) return [];

    const alpha = 2 / (7 + 1); 
    let currentEMA = chronologicalLogs[0].weight; 

    return chronologicalLogs.map(({ log, weight }) => {
      const actualWeight = weight;
      currentEMA = (alpha * actualWeight) + ((1 - alpha) * currentEMA);
      const shortDate = new Date(log.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
      
      return {
        date: shortDate,
        Actual: actualWeight,
        Trend: parseFloat(currentEMA.toFixed(2))
      };
    });
  }, [dailyLogs, isTdeeTabVisible]);

  useEffect(() => {
    if (!isTdeeTabVisible || dailyLogs.length < 2 || weightTrendData.length < 2) {
      const resetTimer = window.setTimeout(() => {
        setChartReady(false);
        setChartSize({ width: 0, height: CHART_HEIGHT });
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    let resizeObserver = null;
    const syncChartSize = () => {
      const chartFrame = chartFrameRef.current;
      if (!chartFrame) {
        setChartReady(false);
        return;
      }

      const rect = chartFrame.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height || CHART_HEIGHT);
      const hasValidSize = width > 0 && height > 0;

      setChartSize(prev => (
        prev.width === width && prev.height === height
          ? prev
          : { width: hasValidSize ? width : 0, height: hasValidSize ? height : CHART_HEIGHT }
      ));
      setChartReady(hasValidSize);
    };

    const syncTimer = window.setTimeout(() => {
      setChartReady(false);
      setChartSize({ width: 0, height: CHART_HEIGHT });
      syncChartSize();

      if (typeof ResizeObserver !== 'undefined' && chartFrameRef.current) {
        resizeObserver = new ResizeObserver(syncChartSize);
        resizeObserver.observe(chartFrameRef.current);
      }
    }, 0);

    return () => {
      window.clearTimeout(syncTimer);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [dailyLogs.length, isTdeeTabVisible, weightTrendData.length]);

  const shouldMountWeightChart = Boolean(
    isTdeeTabVisible &&
    chartReady &&
    dailyLogs.length >= 2 &&
    weightTrendData.length >= 2 &&
    chartSize.width > 0 &&
    chartSize.height > 0
  );

  const deleteDailyLog = async (logId) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "daily_logs", logId));
      alert("Nutrition log deleted successfully!");
    } catch (error) { 
      alert("Failed to delete log: " + error.message); 
    }
  };

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentWeek = useCallback(() => {
    const curr = new Date();
    curr.setDate(curr.getDate() + (weekOffset * 7));
    
    const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1); 
    const week = [];
    
    for (let i = 0; i < 7; i++) {
      let next = new Date(curr.getTime());
      next.setDate(first + i);
      
      const realToday = new Date();
      const isActuallyToday = realToday.getDate() === next.getDate() && 
                              realToday.getMonth() === next.getMonth() && 
                              realToday.getFullYear() === next.getFullYear();

      week.push({
        dayName: next.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0), 
        date: next.getDate(),
        matchString: next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
        isToday: isActuallyToday
      });
    }
    return week;
  }, [weekOffset]);

  const currentWeekDays = useMemo(() => getCurrentWeek(), [getCurrentWeek]);

  const workoutDayMatchStrings = useMemo(() => {
    const matches = new Set();
    currentWeekDays.forEach(dayInfo => {
      if (workoutHistory.some(entry => (entry.date || '').includes(dayInfo.matchString))) {
        matches.add(dayInfo.matchString);
      }
    });
    return matches;
  }, [currentWeekDays, workoutHistory]);

  const filteredWorkoutHistory = useMemo(() => (
    selectedDate
      ? workoutHistory.filter(entry => (entry.date || '').includes(selectedDate))
      : workoutHistory
  ), [selectedDate, workoutHistory]);

  const aiMealTotals = useMemo(() => aiMealReviewItems.reduce((totals, item) => ({
    grams: totals.grams + clampNutritionValue(item.estimatedGrams),
    kcal: totals.kcal + clampNutritionValue(item.kcal),
    protein: totals.protein + clampNutritionValue(item.protein),
    carbs: totals.carbs + clampNutritionValue(item.carbs),
    fat: totals.fat + clampNutritionValue(item.fat),
  }), {
    grams: 0,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  }), [aiMealReviewItems]);

  const clearAiMeal = () => {
    if (mealPhotoInputRef.current) {
      mealPhotoInputRef.current.value = '';
    }
    setAiMealInputMode('');
    setMealPhotoPreview('');
    setMealPhotoBase64('');
    setMealPhotoMimeType('image/jpeg');
    setMealPhotoError('');
    setMealDescriptionInput('');
    setAiMealResult(null);
    setAiMealReviewItems([]);
    setAiMealError('');
  };

  const applyAiMealAnalysis = (analysis) => {
    setAiMealResult(analysis);
    setAiMealReviewItems(analysis.items.map((item, index) => ({
      ...item,
      reviewId: `${Date.now()}-${index}`,
    })));
    setAiMealError('');
  };

  const applySelectedMealPhoto = (base64String, mimeType = 'image/jpeg') => {
    const paddingLength = (base64String.match(/=*$/)?.[0].length || 0);
    const estimatedBytes = Math.ceil((base64String.length * 3) / 4) - paddingLength;
    if (estimatedBytes > MAX_MEAL_IMAGE_SIZE_BYTES) {
      throw new Error('That image is too large. Choose a photo smaller than 5 MB.');
    }

    setMealPhotoBase64(base64String);
    setMealPhotoMimeType(mimeType);
    setMealPhotoPreview(`data:${mimeType};base64,${base64String}`);
    setAiMealResult(null);
    setAiMealReviewItems([]);
  };

  const handleMealPhotoFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAiMealInputMode('photo');
    setMealPhotoError('');
    setAiMealError('');

    if (!file.type.startsWith('image/')) {
      setMealPhotoError('Choose an image file to scan your meal.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_MEAL_IMAGE_SIZE_BYTES) {
      setMealPhotoError('That image is too large. Choose a photo smaller than 5 MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dataUrl = String(reader.result || '');
        const separatorIndex = dataUrl.indexOf(',');
        if (separatorIndex < 0) {
          throw new Error('Could not read that image. Please choose another photo.');
        }

        applySelectedMealPhoto(
          dataUrl.slice(separatorIndex + 1),
          file.type || 'image/jpeg',
        );
      } catch (error) {
        setMealPhotoError(error?.message || 'Could not read that image.');
      }
    };
    reader.onerror = () => {
      setMealPhotoError('Could not read that image. Please choose another photo.');
    };
    reader.readAsDataURL(file);
  };

  const selectMealPhoto = async () => {
    setAiMealInputMode('photo');
    setMealPhotoError('');
    setAiMealError('');

    if (Capacitor.getPlatform() === 'web') {
      if (mealPhotoInputRef.current) {
        mealPhotoInputRef.current.value = '';
        mealPhotoInputRef.current.click();
      }
      return;
    }

    try {
      const photo = await Camera.getPhoto({
        quality: 75,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt,
        promptLabelHeader: 'Add meal photo',
        promptLabelCancel: 'Cancel',
        promptLabelPhoto: 'Choose from Library',
        promptLabelPicture: 'Take Photo',
      });

      if (!photo.base64String) {
        throw new Error('No image was selected. Please try again.');
      }

      applySelectedMealPhoto(
        photo.base64String,
        `image/${photo.format || 'jpeg'}`,
      );
    } catch (error) {
      const message = error?.message || '';
      const normalizedMessage = message.toLowerCase();

      if (normalizedMessage.includes('cancel')) return;
      if (normalizedMessage.includes('permission') || normalizedMessage.includes('denied')) {
        setMealPhotoError('Camera or photo library permission was denied. Enable access in iPhone Settings and try again.');
        return;
      }

      setMealPhotoError(message || 'Could not open the camera or photo library.');
    }
  };

  const analyzeSelectedMealPhoto = async () => {
    if (!mealPhotoBase64) {
      setMealPhotoError('Choose a meal photo before analyzing.');
      return;
    }

    setIsAnalyzingMealPhoto(true);
    setMealPhotoError('');
    setAiMealError('');

    try {
      const analysis = await analyzeMealImage(mealPhotoBase64, mealPhotoMimeType);
      applyAiMealAnalysis(analysis);
    } catch (error) {
      setAiMealError(error?.message || 'Meal photo analysis failed. Please try again.');
    } finally {
      setIsAnalyzingMealPhoto(false);
    }
  };

  const analyzeEnteredMealDescription = async () => {
    if (!mealDescriptionInput.trim()) {
      setAiMealError('Describe your meal before analyzing.');
      return;
    }

    setIsAnalyzingMealDescription(true);
    setAiMealError('');

    try {
      const analysis = await analyzeMealDescription(mealDescriptionInput);
      applyAiMealAnalysis(analysis);
    } catch (error) {
      setAiMealError(error?.message || 'Meal description analysis failed. Please try again.');
    } finally {
      setIsAnalyzingMealDescription(false);
    }
  };

  const updateAiMealReviewItem = (reviewId, field, value) => {
    setAiMealReviewItems(items => items.map(item => (
      item.reviewId === reviewId ? { ...item, [field]: value } : item
    )));
  };

  const removeAiMealReviewItem = (reviewId) => {
    setAiMealReviewItems(items => items.filter(item => item.reviewId !== reviewId));
  };

  const addAiMealReviewItem = () => {
    setAiMealReviewItems(items => [
      ...items,
      {
        reviewId: `manual-${Date.now()}`,
        name: 'New item',
        estimatedGrams: 0,
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        confidence: 0.5,
      },
    ]);
  };

  const saveAiMealToDailyLog = async () => {
    if (!user || !db) {
      setAiMealError('You must be logged in before saving a meal.');
      return;
    }

    if (!aiMealResult || aiMealReviewItems.length === 0) {
      setAiMealError('Add at least one reviewed food item before saving.');
      return;
    }

    const reviewedItems = aiMealReviewItems.map(item => ({
      name: String(item.name || 'Meal item').trim() || 'Meal item',
      estimatedGrams: roundNutritionValue(item.estimatedGrams),
      kcal: roundNutritionValue(item.kcal),
      protein: roundNutritionValue(item.protein),
      carbs: roundNutritionValue(item.carbs),
      fat: roundNutritionValue(item.fat),
      confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0)),
    }));

    const totals = reviewedItems.reduce((sum, item) => ({
      grams: sum.grams + item.estimatedGrams,
      kcal: sum.kcal + item.kcal,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }), {
      grams: 0,
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });

    const todayId = getTodayDocId();
    const logRef = doc(db, "users", user.uid, "daily_logs", todayId);
    setIsSavingAiMeal(true);
    setAiMealError('');

    try {
      const docSnap = await getDoc(logRef);
      const currentData = docSnap.exists() ? docSnap.data() : {};
      const currentFoods = [...(currentData.foods || [])];

      currentFoods.push({
        name: String(aiMealResult.mealName || 'AI Meal').trim() || 'AI Meal',
        weight: roundNutritionValue(totals.grams),
        kcal: roundNutritionValue(totals.kcal),
        protein: roundNutritionValue(totals.protein),
        carbs: roundNutritionValue(totals.carbs),
        fat: roundNutritionValue(totals.fat),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        source: 'ai_meal_scan',
        confidence: Math.min(1, Math.max(0, Number(aiMealResult.confidence) || 0)),
        items: reviewedItems,
      });

      await setDoc(logRef, {
        timestamp: currentData.timestamp || Date.now(),
        date: new Date().toLocaleDateString('en-US'),
        foods: currentFoods,
        calories: roundNutritionValue(clampNutritionValue(currentData.calories) + totals.kcal),
        protein: roundNutritionValue(clampNutritionValue(currentData.protein) + totals.protein),
        carbs: roundNutritionValue(clampNutritionValue(currentData.carbs) + totals.carbs),
        fat: roundNutritionValue(clampNutritionValue(currentData.fat) + totals.fat),
        weight: currentData.weight || '',
      }, { merge: true });

      alert("Meal saved to today's calories!");
      clearAiMeal();
    } catch (error) {
      setAiMealError(`Could not save this meal: ${error?.message || 'Unknown database error.'}`);
    } finally {
      setIsSavingAiMeal(false);
    }
  };

  const updateDailyWeight = async () => {
    if (!dailyWeight) return alert("Please enter your weight!");
    
    const todayId = getTodayDocId();
    const logRef = doc(db, "users", user.uid, "daily_logs", todayId);

    try {
      await setDoc(logRef, {
        timestamp: Date.now(), 
        date: new Date().toLocaleDateString('en-US'),
        weight: parseFloat(dailyWeight)
      }, { merge: true });
      
      alert("Body weight updated securely!");
      setDailyWeight('');
    } catch (e) {
      alert("Database Error: " + e.message);
    }
  };

  // --- WORKOUT LOGIC ---
  const startWorkout = () => {
    const startedAt = Date.now();
    workoutStartedAtRef.current = startedAt;
    setWorkoutStartedAt(startedAt);
    setIsWorkoutActive(true);
    setActiveWorkout({});
    setCurrentTemplateId(null);
    setCurrentTemplateName('');
  };

  const discardWorkout = () => {
    if(window.confirm("Are you sure you want to discard this session? All progress will be lost.")) {
      workoutStartedAtRef.current = null;
      setWorkoutStartedAt(null);
      setIsWorkoutActive(false);
      setActiveWorkout({});
      setCurrentTemplateId(null);
      setCurrentTemplateName('');
    }
  };

  const addExerciseToWorkout = (exerciseName) => {
    if (!activeWorkout[exerciseName]) {
      setActiveWorkout(prev => ({ ...prev, [exerciseName]: [{ reps: '', weight: '', completed: false }] }));
    }
    setShowExerciseModal(false);
  };

  const openExerciseHistoryModal = (e, exerciseName) => {
    e.stopPropagation();
    setSelectedExerciseHistoryName(exerciseName);
  };

  const openCreateExerciseModal = (context = 'workout') => {
    const sourceSearchQuery = context === 'template'
      ? templateExerciseSearch
      : context === 'import'
        ? importExerciseSearch
        : exerciseSearchQuery;

    setCreateExerciseContext(context);
    setNewExerciseName(sourceSearchQuery.trim());
    setNewExerciseMuscleGroup('');
    setNewExerciseNotes('');
    setCreateExerciseError('');
    setShowCreateExerciseModal(true);
  };

  const closeCreateExerciseModal = () => {
    setShowCreateExerciseModal(false);
    setCreateExerciseError('');
  };

  const saveCustomExercise = async () => {
    if (!user || isSavingCustomExerciseRef.current) return;

    const exerciseName = newExerciseName.trim();
    const muscleGroup = newExerciseMuscleGroup.trim();
    const notes = newExerciseNotes.trim();

    if (!exerciseName) {
      setCreateExerciseError('Exercise name is required.');
      return;
    }

    if (!muscleGroup) {
      setCreateExerciseError('Please select a muscle group.');
      return;
    }

    const alreadyExistsInGroup = allExerciseLibrary.some(exercise =>
      exercise.muscleGroup === muscleGroup &&
      exercise.exerciseName.toLowerCase() === exerciseName.toLowerCase()
    );

    if (alreadyExistsInGroup) {
      setCreateExerciseError('An exercise with this name already exists in this muscle group.');
      return;
    }

    const now = Date.now();
    const exerciseDoc = {
      name: exerciseName,
      muscleGroup,
      createdAt: now,
      updatedAt: now,
      isCustom: true,
    };

    if (notes) exerciseDoc.notes = notes;

    isSavingCustomExerciseRef.current = true;
    setIsSavingCustomExercise(true);

    try {
      const docRef = await addDoc(collection(db, "users", user.uid, "custom_exercises"), exerciseDoc);
      setLastCreatedExerciseId(docRef.id);
      setCustomExercises(prev => dedupeById([
        ...prev,
        { id: docRef.id, ...exerciseDoc },
      ]));

      if (createExerciseContext === 'template') {
        setTemplateExerciseSearch(exerciseName);
        setTemplateFormError('');
      } else if (createExerciseContext === 'import') {
        setImportExerciseSearch(exerciseName);
        setImportTemplateError('');
      } else {
        setExerciseSearchQuery(exerciseName);
      }

      setShowCreateExerciseModal(false);
      setNewExerciseName('');
      setNewExerciseMuscleGroup('');
      setNewExerciseNotes('');
      setCreateExerciseError('');
    } catch (error) {
      setCreateExerciseError("Error creating exercise: " + error.message);
    } finally {
      isSavingCustomExerciseRef.current = false;
      setIsSavingCustomExercise(false);
    }
  };

  const resetImportTemplateForm = () => {
    importParseRequestIdRef.current += 1;
    setImportImagePreview('');
    setImportImageBase64('');
    setImportImageMimeType('image/jpeg');
    setImportImageFileName('');
    setIsParsingTemplateImage(false);
    setHasParsedImport(false);
    setImportTemplateError('');
    setImportedTemplateName('');
    setImportedTemplateExercises([]);
    setImportRawText('');
    setImportExerciseSearch('');
  };

  const openImportTemplateModal = () => {
    resetImportTemplateForm();
    setShowImportTemplateModal(true);
  };

  const closeImportTemplateModal = () => {
    setShowImportTemplateModal(false);
    setShowCreateExerciseModal(false);
    resetImportTemplateForm();
  };

  const buildImportedExerciseReview = (parsedExercise) => {
    const mappedExercise = mapParsedExerciseToTemplateExercise(parsedExercise, allExerciseLibrary);

    return {
      ...mappedExercise,
      setCount: String(mappedExercise.sets.length || 1),
      reps: getUniformSetValue(mappedExercise.sets, 'reps'),
      weight: getUniformSetValue(mappedExercise.sets, 'weight'),
    };
  };

  const buildLibraryExerciseForImport = (exercise) => ({
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exerciseName,
    muscleGroup: exercise.muscleGroup,
    setCount: '3',
    reps: '',
    weight: '',
    notes: '',
    confidence: 1,
    isNewExercise: false,
  });

  const refreshImportedExerciseLibraryStatus = (exercise) => {
    const libraryMatch = findExerciseLibraryMatch(exercise.exerciseName, exercise.muscleGroup, allExerciseLibrary);

    return {
      ...exercise,
      exerciseId: libraryMatch?.exerciseId || createImportedExerciseId(exercise.muscleGroup, exercise.exerciseName),
      isNewExercise: !libraryMatch,
    };
  };

  const handleImportImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    const requestId = importParseRequestIdRef.current + 1;
    importParseRequestIdRef.current = requestId;
    setImportImagePreview('');
    setImportImageBase64('');
    setImportImageMimeType('image/jpeg');
    setImportImageFileName('');
    setIsParsingTemplateImage(false);
    setImportedTemplateName('');
    setImportedTemplateExercises([]);
    setImportRawText('');
    setHasParsedImport(false);
    setImportTemplateError('');

    const acceptedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!acceptedTypes.includes(file.type)) {
      setImportTemplateError('Please upload a PNG, JPG, JPEG, or WEBP image.');
      return;
    }

    if (file.size > MAX_TEMPLATE_IMAGE_SIZE_BYTES) {
      setImportTemplateError('Image must be 5MB or smaller.');
      return;
    }

    const fileMimeType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;

    const reader = new FileReader();
    reader.onload = () => {
      if (importParseRequestIdRef.current !== requestId) return;

      const dataUrl = String(reader.result || '');
      setImportImagePreview(dataUrl);
      setImportImageBase64(dataUrl.split(',')[1] || '');
      setImportImageMimeType(fileMimeType);
      setImportImageFileName(file.name);
    };
    reader.onerror = () => {
      if (importParseRequestIdRef.current !== requestId) return;

      setImportTemplateError('Could not read this image. Try a clearer image or enter the template manually.');
    };
    reader.readAsDataURL(file);
  };

  const parseImportedTemplateImage = async () => {
    if (!importImageBase64) {
      setImportTemplateError('Please upload an image before parsing.');
      return;
    }

    const requestId = importParseRequestIdRef.current + 1;
    importParseRequestIdRef.current = requestId;
    const imageBase64ToParse = importImageBase64;

    setIsParsingTemplateImage(true);
    setImportTemplateError('');
    setImportedTemplateName('');
    setImportedTemplateExercises([]);
    setImportRawText('');
    setHasParsedImport(false);

    try {
      const mimeTypeToParse = importImageMimeType;
      const parsedTemplate = await parseWorkoutTemplateImage(imageBase64ToParse, mimeTypeToParse);
      if (importParseRequestIdRef.current !== requestId) return;

      const parsedExercises = Array.isArray(parsedTemplate.exercises) ? parsedTemplate.exercises : [];
      const mappedExercises = parsedExercises
        .map(buildImportedExerciseReview)
        .filter(exercise => exercise.exerciseName);

      setImportedTemplateName(parsedTemplate.templateName || 'Imported Workout Template');
      setImportedTemplateExercises(mappedExercises);
      setImportRawText(parsedTemplate.rawText || '');
      setHasParsedImport(true);
    } catch (error) {
      if (importParseRequestIdRef.current !== requestId) return;

      setHasParsedImport(false);
      setImportedTemplateExercises([]);
      setImportTemplateError(error.message || 'Could not detect a workout plan from this image. Try a clearer image or enter the template manually.');
    } finally {
      if (importParseRequestIdRef.current === requestId) {
        setIsParsingTemplateImage(false);
      }
    }
  };

  const updateImportedTemplateExercise = (index, field, value) => {
    setImportedTemplateExercises(prev => prev.map((exercise, exerciseIndex) => {
      if (exerciseIndex !== index) return exercise;

      const nextExercise = {
        ...exercise,
        [field]: field === 'setCount' ? value.replace(/[^\d]/g, '') : value,
      };

      if (field === 'exerciseName' || field === 'muscleGroup') {
        return refreshImportedExerciseLibraryStatus(nextExercise);
      }

      return nextExercise;
    }));
    setImportTemplateError('');
  };

  const removeImportedTemplateExercise = (index) => {
    setImportedTemplateExercises(prev => prev.filter((_, exerciseIndex) => exerciseIndex !== index));
    setImportTemplateError('');
  };

  const addExerciseToImportedTemplate = (exercise) => {
    const alreadyAdded = importedTemplateExercises.some(importedExercise =>
      importedExercise.exerciseName.toLowerCase() === exercise.exerciseName.toLowerCase() &&
      importedExercise.muscleGroup === exercise.muscleGroup
    );

    if (alreadyAdded) {
      setImportTemplateError('This exercise is already in the imported template.');
      return;
    }

    setImportedTemplateExercises(prev => [...prev, buildLibraryExerciseForImport(exercise)]);
    setImportExerciseSearch('');
    setImportTemplateError('');
  };

  const saveImportedTemplate = async () => {
    if (!user || isSavingImportedTemplateRef.current) return;

    const templateNameValue = importedTemplateName.trim();
    if (!templateNameValue) {
      setImportTemplateError('Template name is required.');
      return;
    }

    if (importedTemplateExercises.length === 0) {
      setImportTemplateError('Add at least one exercise before saving this template.');
      return;
    }

    const reviewedExercises = importedTemplateExercises.map(refreshImportedExerciseLibraryStatus);
    if (!reviewedExercises.every(isValidImportedExercise)) {
      setImportTemplateError('Review each exercise. Name, muscle group, and sets are required.');
      return;
    }

    const newExercises = detectNewExercises(reviewedExercises, allExerciseLibrary);
    const shouldSaveNewExercises = newExercises.length > 0
      ? window.confirm('Some exercises are not in your library. Save them as custom exercises?')
      : false;

    const now = Date.now();
    const savedCustomExerciseIds = {};
    let lastCustomExerciseId = '';
    const identityKey = (exercise) => `${exercise.muscleGroup}|${exercise.exerciseName.toLowerCase()}`;

    isSavingImportedTemplateRef.current = true;
    setIsSavingImportedTemplate(true);

    try {
      if (shouldSaveNewExercises) {
        const uniqueNewExercises = reviewedExercises.reduce((items, exercise) => {
          if (!exercise.isNewExercise) return items;

          const key = identityKey(exercise);
          if (items.some(item => identityKey(item) === key)) return items;
          return [...items, exercise];
        }, []);

        for (const exercise of uniqueNewExercises) {
          const exerciseDoc = {
            name: exercise.exerciseName.trim(),
            muscleGroup: exercise.muscleGroup,
            createdAt: now,
            updatedAt: now,
            isCustom: true,
          };

          if (exercise.notes.trim()) exerciseDoc.notes = exercise.notes.trim();

          const docRef = await addDoc(collection(db, "users", user.uid, "custom_exercises"), exerciseDoc);
          savedCustomExerciseIds[identityKey(exercise)] = docRef.id;
          lastCustomExerciseId = docRef.id;
          setCustomExercises(prev => dedupeById([
            ...prev,
            { id: docRef.id, ...exerciseDoc },
          ]));
        }

        if (lastCustomExerciseId) {
          setLastCreatedExerciseId(lastCustomExerciseId);
        }
      }

      const templateExercisesForSave = reviewedExercises.map(exercise => {
        const libraryMatch = findExerciseLibraryMatch(exercise.exerciseName, exercise.muscleGroup, allExerciseLibrary);
        const exerciseId = savedCustomExerciseIds[identityKey(exercise)]
          || libraryMatch?.exerciseId
          || exercise.exerciseId
          || createImportedExerciseId(exercise.muscleGroup, exercise.exerciseName);

        return normalizeTemplateExercise({
          exerciseId,
          exerciseName: exercise.exerciseName,
          muscleGroup: exercise.muscleGroup,
          notes: exercise.notes,
          sets: createDefaultTemplateSet(exercise.setCount, exercise.reps, exercise.weight),
        });
      });

      const templateDoc = {
        name: templateNameValue,
        exercises: templateExercisesForSave,
        source: 'image_import',
        createdAt: now,
        updatedAt: now,
      };

      if (importRawText.trim()) templateDoc.rawImportText = importRawText.trim();

      const docRef = await addDoc(collection(db, "users", user.uid, "workout_templates"), templateDoc);
      setWorkoutTemplates(prev => sortByUpdatedAtDesc(dedupeById([
        { id: docRef.id, ...templateDoc },
        ...prev,
      ])));
      closeImportTemplateModal();
    } catch (error) {
      setImportTemplateError("Error saving imported template: " + error.message);
    } finally {
      isSavingImportedTemplateRef.current = false;
      setIsSavingImportedTemplate(false);
    }
  };

  const resetTemplateForm = () => {
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateNotes('');
    setTemplateExercises([]);
    setTemplateExerciseSearch('');
    setTemplateFormError('');
  };

  const openCreateTemplateModal = () => {
    resetTemplateForm();
    setShowTemplateModal(true);
  };

  const openEditTemplateModal = (template) => {
    setEditingTemplateId(template.id);
    setTemplateName(template.name || '');
    setTemplateNotes(template.notes || '');
    setTemplateExercises((template.exercises || []).map(normalizeTemplateExercise));
    setTemplateExerciseSearch('');
    setTemplateFormError('');
    setShowTemplateModal(true);
  };

  const closeTemplateModal = () => {
    setShowTemplateModal(false);
    resetTemplateForm();
  };

  const addExerciseToTemplate = (exercise) => {
    const alreadyAdded = templateExercises.some(templateExercise =>
      templateExercise.exerciseName.toLowerCase() === exercise.exerciseName.toLowerCase() &&
      templateExercise.muscleGroup === exercise.muscleGroup
    );

    if (alreadyAdded) {
      setTemplateFormError('This exercise is already in the template.');
      return;
    }

    setTemplateExercises(prev => [
      ...prev,
      normalizeTemplateExercise({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        muscleGroup: exercise.muscleGroup,
        sets: createDefaultTemplateSet(3),
      }),
    ]);
    setTemplateExerciseSearch('');
    setTemplateFormError('');
  };

  const moveTemplateExercise = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= templateExercises.length) return;
    setTemplateExercises(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const removeTemplateExercise = (index) => {
    setTemplateExercises(prev => prev.filter((_, exerciseIndex) => exerciseIndex !== index));
    setTemplateFormError('');
  };

  const updateTemplateExerciseSetCount = (index, count) => {
    setTemplateExercises(prev => prev.map((exercise, exerciseIndex) => {
      if (exerciseIndex !== index) return exercise;

      const currentSets = exercise.sets || [];
      const fallbackSet = currentSets[0] || { reps: '', weight: '' };
      return {
        ...exercise,
        sets: createDefaultTemplateSet(count, fallbackSet.reps, fallbackSet.weight),
      };
    }));
  };

  const updateTemplateExerciseSetValue = (index, field, value) => {
    setTemplateExercises(prev => prev.map((exercise, exerciseIndex) => {
      if (exerciseIndex !== index) return exercise;

      return {
        ...exercise,
        sets: (exercise.sets || []).map(set => ({ ...set, [field]: value })),
      };
    }));
  };

  const saveWorkoutTemplate = async () => {
    if (!user || isSavingTemplateRef.current) return;

    const normalizedExercises = templateExercises.map(normalizeTemplateExercise);
    const validation = validateTemplate({
      name: templateName,
      exercises: normalizedExercises,
    });

    if (!validation.isValid) {
      setTemplateFormError(validation.message);
      return;
    }

    const now = Date.now();
    const existingTemplate = workoutTemplates.find(template => template.id === editingTemplateId);
    const notes = templateNotes.trim();
    const templateDoc = {
      name: templateName.trim(),
      exercises: normalizedExercises,
      createdAt: existingTemplate?.createdAt || now,
      updatedAt: now,
    };

    if (notes) templateDoc.notes = notes;

    isSavingTemplateRef.current = true;
    setIsSavingTemplate(true);

    try {
      if (editingTemplateId) {
        await setDoc(doc(db, "users", user.uid, "workout_templates", editingTemplateId), templateDoc);
        setWorkoutTemplates(prev => sortByUpdatedAtDesc(prev.map(template => (
          template.id === editingTemplateId ? { id: editingTemplateId, ...templateDoc } : template
        ))));
      } else {
        const docRef = await addDoc(collection(db, "users", user.uid, "workout_templates"), templateDoc);
        setWorkoutTemplates(prev => sortByUpdatedAtDesc(dedupeById([
          { id: docRef.id, ...templateDoc },
          ...prev,
        ])));
      }

      closeTemplateModal();
    } catch (error) {
      setTemplateFormError("Error saving template: " + error.message);
    } finally {
      isSavingTemplateRef.current = false;
      setIsSavingTemplate(false);
    }
  };

  const deleteWorkoutTemplate = async (template) => {
    if (!user) return;
    if (!window.confirm(`Delete template "${template.name}"?`)) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "workout_templates", template.id));
      setWorkoutTemplates(prev => prev.filter(item => item.id !== template.id));
    } catch (error) {
      alert("Error deleting template: " + error.message);
    }
  };

  const startWorkoutFromTemplate = (template, startedAt) => {
    const templateWorkout = convertTemplateToActiveWorkout(template);
    if (Object.keys(templateWorkout).length === 0) {
      alert("This template has no exercises.");
      return;
    }

    workoutStartedAtRef.current = startedAt;
    setWorkoutStartedAt(startedAt);
    setActiveWorkout(templateWorkout);
    setCurrentTemplateId(template.id);
    setCurrentTemplateName(template.name || '');
    setIsWorkoutActive(true);
  };

  const updateSet = useCallback((exercise, setIndex, field, value) => {
    setActiveWorkout(prev => ({
      ...prev,
      [exercise]: (prev[exercise] || []).map((set, index) => (
        index === setIndex ? { ...set, [field]: value } : set
      )),
    }));
  }, []);

  const addSet = useCallback((exercise) => {
    setActiveWorkout(prev => {
      const currentSets = prev[exercise] || [];
    
      let inheritedWeight = '';
      let inheritedReps = '';
    
      if (currentSets.length > 0) {
        const lastSet = currentSets[currentSets.length - 1];
        inheritedWeight = lastSet.weight;
        inheritedReps = lastSet.reps;
      }

      return {
        ...prev,
        [exercise]: [
          ...currentSets,
          { reps: inheritedReps, weight: inheritedWeight, completed: false },
        ],
      };
    });
  }, []);

  const toggleSetCompletion = useCallback((exercise, setIndex) => {
    setActiveWorkout(prev => ({
      ...prev,
      [exercise]: (prev[exercise] || []).map((set, index) => (
        index === setIndex ? { ...set, completed: !set.completed } : set
      )),
    }));
  }, []);

  const finishWorkout = async () => {
    if (Object.keys(activeWorkout).length === 0) return alert("Log data to proceed.");
    try {
      const historyDoc = {
        timestamp: Date.now(),
        date: new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        matchDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
        duration: formatTime(getWorkoutDurationSeconds()),
        data: activeWorkout,
      };

      if (currentTemplateId && currentTemplateName) {
        historyDoc.templateId = currentTemplateId;
        historyDoc.templateName = currentTemplateName;
      }

      await addDoc(collection(db, "users", user.uid, "history"), historyDoc);
      workoutStartedAtRef.current = null;
      setWorkoutStartedAt(null);
      setIsWorkoutActive(false);
      setActiveWorkout({});
      setCurrentTemplateId(null);
      setCurrentTemplateName('');
      setActiveTab('history');
      setSelectedDate(null);
    } catch (e) { alert("Error saving workout: " + e.message); }
  };

  const deleteHistoryEntry = async (entryId) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "history", entryId));
      alert("Workout session deleted successfully!");
    } catch (error) { 
      alert("Failed to delete workout: " + error.message); 
    }
  };

  const handleAuth = async (type) => {
    if (!auth) {
      const error = new Error("Firebase Auth is unavailable. Please restart the app and try again.");
      console.error("Firebase Auth action failed:", error);
      alert(error.message);
      return;
    }

    const sanitizedEmail = email.trim();
    if (!sanitizedEmail) return alert("Please enter an email address.");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) return alert("Please enter a formally valid email format.");
    if (!password || password.length < 6) return alert("Password must be at least 6 characters.");

    try {
      if (type === 'signup') await createUserWithEmailAndPassword(auth, sanitizedEmail, password);
      else await signInWithEmailAndPassword(auth, sanitizedEmail, password);
    } catch (e) {
      console.error("Firebase Auth action failed:", e);
      alert("Firebase Protocol: " + e.message);
    }
  };

  const handleSignOut = async () => {
    if (!auth) {
      const error = new Error("Firebase Auth is unavailable. Please restart the app and try again.");
      console.error("Firebase sign-out failed:", error);
      alert(error.message);
      return;
    }

    try {
      await signOut(auth);
    } catch (error) {
      console.error("Firebase sign-out failed:", error);
      alert("Sign out failed: " + error.message);
    }
  };

  // --- RENDER FLOW ---
  if (authLoading) {
    return (
      <main className="app-shell app-shell-loading" style={styles.appContainer} aria-live="polite">
        <BrandLockup />
        <div className="loading-indicator" aria-hidden="true"><span /><span /><span /></div>
        <p style={styles.loadingText}>{authStartupSlow ? 'Still loading your session...' : 'Loading your training space...'}</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="app-shell auth-screen" style={styles.appContainer}>
        <section className="auth-story" aria-labelledby="auth-title">
          <BrandLockup />
          <div className="auth-story__copy">
            <p className="auth-kicker">Training, clearly measured</p>
            <h1 id="auth-title">Every useful number, in one calm place.</h1>
            <p>Plan sessions, log hard sets, review progress, and keep nutrition beside the work that drives it.</p>
          </div>
          <div className="auth-artwork" aria-hidden="true">
            <img src={heroArtwork} alt="" />
          </div>
          <div className="auth-marquee" aria-hidden="true">
            <div>TRAIN · RECOVER · REPEAT · TRACK · ADAPT · TRAIN · RECOVER · REPEAT ·</div>
          </div>
        </section>

        <section className="auth-panel" aria-label="Sign in to Elite Tracker">
          <div className="auth-panel__heading">
            <p>Welcome back</p>
            <h2>Continue your plan</h2>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); handleAuth('login'); }}>
            <label className="field-label" htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              style={styles.authInput}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label className="field-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete="current-password"
              placeholder="At least 6 characters"
              style={styles.authInput}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="submit" className="mu-button mu-main-btn" style={styles.authButton}>Sign in</button>
            <button type="button" className="mu-button mu-secondary-btn" onClick={() => handleAuth('signup')} style={{...styles.authButton, ...styles.secondaryButton}}>Create account</button>
          </form>
          <p className="auth-panel__note">Your training and nutrition data stays connected to this account.</p>
        </section>
      </main>
    );
  }

  const profileInitial = (user.email || 'U').trim().charAt(0).toUpperCase();
  const shouldShowBottomNav = isBottomNavVisible && !isAnyModalOpen;

  return (
    <div className="app-shell app-shell--authenticated" style={styles.appContainer}>
      {!isWorkoutActive && (
        <AppHeader profileInitial={profileInitial} onOpenProfile={() => handleTabSelect('you')} />
      )}

      <main
        ref={contentScrollRef}
        className="content-scroll"
        style={styles.contentScroll}
        onScroll={handleContentScroll}
      >
        {/* WORKOUT TAB */}
        {visibleTab === 'workout' && (
          <div className="tab-scene screen screen--workout">
            {!isWorkoutActive ? (
              <WorkoutMotion scrollContainer={contentScrollRef}>
                <div className="workout-home" style={styles.workoutHome}>
                  <div className="workout-bento">
                    <section className="workout-hero premium-card" style={styles.startPanel} aria-labelledby="workout-title">
                      <div className="workout-hero__content">
                        <p className="workout-hero__kicker">Today’s training</p>
                        <h1 id="workout-title">
                          Train with
                          <span className="workout-hero__inline-art" aria-hidden="true">
                            <img src={heroArtwork} alt="" data-workout-artwork />
                          </span>
                          intent.
                        </h1>
                        <button className="mu-button mu-main-btn hero-primary-action" onClick={startWorkout} style={styles.mainBtn}>
                          <FitnessIcon name="play" size={18} /> Start empty workout
                        </button>
                      </div>
                      <div className="workout-marquee" aria-hidden="true">
                        <div>LOAD · REPS · CONTROL · RANGE · RECOVERY · LOAD · REPS · CONTROL ·</div>
                      </div>
                    </section>

                    <button type="button" className="workout-utility-card workout-utility-card--create" onClick={openCreateTemplateModal}>
                      <span className="workout-utility-card__icon"><FitnessIcon name="templates" size={24} /></span>
                      <span>
                        <small>Build once</small>
                        <strong>Create a template</strong>
                      </span>
                      <FitnessIcon name="arrowRight" size={20} />
                    </button>

                    <button type="button" className="workout-utility-card workout-utility-card--import" onClick={openImportTemplateModal}>
                      <span className="workout-utility-card__icon"><FitnessIcon name="importImage" size={24} /></span>
                      <span>
                        <small>Already have a plan?</small>
                        <strong>Import from image</strong>
                      </span>
                      <FitnessIcon name="arrowRight" size={20} />
                    </button>
                  </div>

                <section className="template-section" style={styles.templateSection} aria-labelledby="templates-title">
	                  <div style={styles.templateSectionHeader}>
	                    <div>
	                      <p className="section-kicker">Repeatable sessions</p>
	                      <h2 id="templates-title" style={styles.templateSectionTitle}>Your templates</h2>
	                    </div>
	                    <button className="mu-button mu-secondary-btn compact-icon-action" onClick={openCreateTemplateModal} style={styles.createTemplateBtn}>
	                      <FitnessIcon name="plus" size={17} /> New template
	                    </button>
	                  </div>

                  {templatesError && (
                    <p style={styles.templateErrorText}>{templatesError}</p>
                  )}

                  {workoutTemplates.length === 0 ? (
                    <EmptyState
                      icon="templates"
                      title="No templates yet"
                      action={<button type="button" className="mu-button mu-secondary-btn" onClick={openCreateTemplateModal}>Create your first template</button>}
                    >
                      Save a repeatable session so your next workout starts in one tap.
                    </EmptyState>
                  ) : (
                    <div className="template-accordion" style={styles.templateCardList}>
                      {workoutTemplates.map(template => (
                        <article className="template-card" key={template.id} style={styles.templateCard}>
                          <div style={styles.templateCardHeader}>
                            <div style={{minWidth: 0}}>
                              <h3 style={styles.templateCardTitle}>{template.name}</h3>
                              <p style={styles.templateExerciseCount}>{(template.exercises || []).length} exercises</p>
                            </div>
                          </div>
                          {template.notes && (
                            <p style={styles.templateNotes}>{template.notes}</p>
                          )}
                          <div style={styles.templateCardActions}>
                            <button className="mu-button mu-main-btn" onClick={() => startWorkoutFromTemplate(template, Date.now())} style={styles.templateStartBtn}><FitnessIcon name="play" size={15} /> Start</button>
                            <button className="mu-button mu-secondary-btn" onClick={() => openEditTemplateModal(template)} style={styles.templateActionBtn}><FitnessIcon name="edit" size={15} /> Edit</button>
                            <button className="mu-button mu-danger-btn" onClick={() => deleteWorkoutTemplate(template)} style={styles.templateDeleteBtn}><FitnessIcon name="delete" size={15} /> Delete</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                </div>
              </WorkoutMotion>
            ) : (
              <div className="active-workout">
                <div style={styles.topBar}>
                  <button
                    type="button"
                    className="mu-icon-button"
                    aria-label="Discard workout"
                    onClick={discardWorkout}
                    style={styles.topBarDiscardButton}
                  >
                    <FitnessIcon name="chevronDown" size={22} />
                  </button>
                  <button
                    type="button"
                    className="mu-button mu-main-btn"
                    onClick={finishWorkout}
                    style={styles.topBarFinishButton}
                  >
                    Finish
                  </button>
                </div>
                <TimerDisplay startedAt={workoutStartedAt} style={styles.timerText} />

                {Object.keys(activeWorkout).length === 0 ? (
                  <p style={{textAlign: 'center', color: THEME.textSecondary, marginTop: '40px'}}>Tap below to add your first exercise.</p>
                ) : (
                  Object.entries(activeWorkout).map(([exercise, sets]) => (
                    <WorkoutExerciseBlock
                      key={exercise}
                      exercise={exercise}
                      sets={sets}
                      previous={prevData[exercise]}
                      onAddSet={addSet}
                      onToggleSetCompletion={toggleSetCompletion}
                      onUpdateSet={updateSet}
                    />
                  ))
                )}
                
                <div style={{padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px'}}>
                  <button className="mu-button mu-main-btn" onClick={() => setShowExerciseModal(true)} style={styles.mainBtn}><FitnessIcon name="plus" size={18} /> Add exercises</button>
                  <button className="mu-button mu-secondary-btn" onClick={discardWorkout} style={styles.discardBtn}>Discard Workout</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {visibleTab === 'history' && (
          <div className="tab-scene screen screen--history" style={{padding: '20px'}}>
            <PageHeader title="Training history" description="Review completed sessions and the work behind your progress." />
            
            <div className="week-switcher" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <button className="mu-text-button" onClick={() => { setWeekOffset(w => w - 1); setSelectedDate(null); }} style={styles.navArrow}><FitnessIcon name="arrowLeft" size={17} /> Past</button>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: THEME.textSecondary, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {weekOffset === 0 ? "Current Week" : `${Math.abs(weekOffset)} Week(s) Ago`}
              </span>
              <button className="mu-text-button" onClick={() => { setWeekOffset(w => w + 1); setSelectedDate(null); }} disabled={weekOffset === 0} style={{ ...styles.navArrow, opacity: weekOffset === 0 ? 0.2 : 1 }}>Future <FitnessIcon name="arrowRight" size={17} /></button>
            </div>
            
            <div className="calendar-strip" style={styles.calendarContainer}>
              {currentWeekDays.map(dayInfo => {
                const isWorkoutDay = workoutDayMatchStrings.has(dayInfo.matchString);
                const isSelected = selectedDate === dayInfo.matchString;
                return (
                  <button type="button" key={dayInfo.date} aria-pressed={isSelected} onClick={() => setSelectedDate(isSelected ? null : dayInfo.matchString)} style={{
                    ...styles.calendarDay, 
                    backgroundColor: isSelected ? THEME.primaryRed : (isWorkoutDay ? THEME.goldSoft : THEME.cardBg),
                    border: dayInfo.isToday ? `1px solid ${THEME.primaryRed}` : (isWorkoutDay ? `1px solid rgba(242, 201, 76, 0.4)` : '1px solid transparent'),
                    boxShadow: isSelected ? '0 10px 22px rgba(218, 41, 28, 0.28)' : 'none',
                    cursor: 'pointer', transform: isSelected ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.2s ease'
                  }}>
                    <span style={{fontSize: '10px', color: isSelected ? THEME.textPrimary : (isWorkoutDay ? THEME.accentGold : THEME.textSecondary), fontWeight: 'bold'}}>{dayInfo.dayName}</span>
                    <span style={{fontSize: '16px', color: isSelected ? THEME.textPrimary : (isWorkoutDay ? THEME.accentGold : THEME.textPrimary), fontWeight: 'bold'}}>{dayInfo.date}</span>
                  </button>
                );
              })}
            </div>

            {selectedDate && (
              <p style={{color: THEME.primaryRed, textAlign: 'center', marginBottom: '15px', cursor: 'pointer', fontWeight: 700}} onClick={() => setSelectedDate(null)}>
                Showing workouts for {selectedDate} (Tap to show all)
              </p>
            )}

            {filteredWorkoutHistory.length === 0 ? (
              <p style={{color: THEME.textSecondary, textAlign: 'center', marginTop: '40px'}}>
                {selectedDate ? `No workouts recorded on ${selectedDate}` : "No history available."}
              </p>
            ) : (
              filteredWorkoutHistory.map(entry => (
                <div className="history-card" key={entry.id} style={styles.historyCard}>
                  <div style={styles.historyHeader}>
                    <div>
                      <p style={{margin: 0, fontWeight: 'bold', fontSize: '18px'}}>{entry.date}</p>
                      <p className="history-duration" style={{margin: '5px 0 0 0', color: THEME.accentGold, fontWeight: 'bold', fontSize: '14px'}}><FitnessIcon name="timer" size={15} /> {entry.duration}</p>
                    </div>
                    <button className="mu-button mu-danger-btn" onClick={() => deleteHistoryEntry(entry.id)} style={styles.deleteBtn}><FitnessIcon name="delete" size={15} /> Delete</button>
                  </div>
                  {Object.entries(entry.data).map(([exName, exSets]) => {
                    const completedSets = exSets.filter(s => s.completed);
                    if (completedSets.length === 0) return null;
                    return (
                      <div key={exName} style={styles.historyExerciseBlock}>
                        <p style={styles.historyExerciseTitle}>{exName}</p>
                        {completedSets.map((set, idx) => (
                          <div key={idx} style={styles.historySetRow}>
                            <span style={{fontWeight: 'bold', width: '50px'}}>Set {idx + 1}</span>
                            <div style={styles.dottedLine}></div>
                            <span>{set.weight} kg × {set.reps} reps</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}

        {/* METABOLISM & TREND TAB */}
        {visibleTab === 'tdee' && (
          <div className="tab-scene screen screen--tdee" style={{padding: '20px', minWidth: 0}}>
            <PageHeader title="Metabolism" description="Use daily weight and intake data to estimate your real energy needs." />
            <div className={`tdee-overview${dailyLogs.length >= 2 && weightTrendData.length >= 2 ? ' tdee-overview--with-chart' : ''}`}>
              <div className="panel-card tdee-summary-card" style={styles.dashboardCard}>
                <p style={{color: THEME.textSecondary, margin: '0 0 10px 0'}}>Actual TDEE (Dynamic):</p>
                <p style={{fontSize: '36px', fontWeight: '900', color: THEME.accentGold, margin: 0, letterSpacing: '0'}}>
                  {dynamicTDEE ? `${dynamicTDEE} kcal` : "Collecting data..."}
                </p>
                {!dynamicTDEE && <p style={{fontSize: '12px', color: THEME.textSecondary, marginTop: '10px'}}>A minimum of 7 days logged is required for accurate algorithm calibration.</p>}
              </div>

              {dailyLogs.length >= 2 && weightTrendData.length >= 2 && (
                <div className="panel-card tdee-chart-card" style={styles.sectionCard}>
                  <h3 style={{margin: '0 0 15px 0', fontSize: '18px', color: THEME.textPrimary}}>Weight Trend Analysis</h3>
                  <div ref={chartFrameRef} style={styles.chartFrame}>
                    {shouldMountWeightChart && (
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                        minWidth={1}
                        minHeight={CHART_HEIGHT}
                        debounce={100}
                        initialDimension={{ width: chartSize.width, height: CHART_HEIGHT }}
                      >
                        <LineChart data={weightTrendData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} vertical={false} />
                          <XAxis dataKey="date" stroke={THEME.textSecondary} fontSize={12} tickLine={false} />
                          <YAxis stroke={THEME.textSecondary} fontSize={12} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                          <Tooltip contentStyle={{backgroundColor: THEME.bgDark, border: `1px solid ${THEME.border}`, borderRadius: '8px', color: THEME.textPrimary}} itemStyle={{color: THEME.textPrimary}} />
                          <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px', color: THEME.textSecondary}} />
                          <Line type="monotone" dataKey="Actual" stroke={THEME.accentGold} strokeWidth={2} strokeDasharray="5 5" dot={{r: 3, fill: THEME.accentGold}} name="Scale Weight" />
                          <Line type="monotone" dataKey="Trend" stroke={THEME.primaryRed} strokeWidth={3} dot={false} activeDot={{r: 6, fill: THEME.primaryRed}} name="True Trend (EMA)" />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <p style={{fontSize: '11px', color: THEME.textSecondary, textAlign: 'center', marginTop: '10px'}}>The red line represents your true weight trend, filtering out water retention and noise.</p>
                </div>
              )}
            </div>

            <h3 style={{fontSize: '18px', marginBottom: '15px', textAlign: 'left', color: THEME.textPrimary}}>Daily Check-in</h3>
            <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
              <label className="sr-only" htmlFor="daily-body-weight">Today&apos;s body weight in kilograms</label>
              <input 
                id="daily-body-weight"
                type="number" 
                inputMode="decimal"
                placeholder="Today's Body Weight (kg)" 
                value={dailyWeight} 
                onChange={(e) => setDailyWeight(e.target.value)} 
                style={{...styles.authInput, marginBottom: 0, flex: 1}} 
              />
              <button className="mu-button mu-main-btn" onClick={updateDailyWeight} style={{...styles.mainBtn, width: '100px', borderRadius: '8px'}}>Update</button>
            </div>

            <h3 style={{fontSize: '20px', marginTop: '40px', marginBottom: '20px'}}>Intake History</h3>
            {dailyLogs.length === 0 ? (
              <p style={{color: THEME.textSecondary, textAlign: 'center'}}>No history available.</p>
            ) : (
              dailyLogs.map(log => (
                <div className="history-card" key={log.id} style={styles.historyCard}>
                  <div style={{...styles.historyHeader, borderBottom: log.foods && log.foods.length > 0 ? `1px solid ${THEME.border}` : 'none'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%'}}>
                      <div>
                        <p style={{margin: 0, fontWeight: 'bold', fontSize: '18px'}}>{log.date}</p>
                        <p style={{margin: '5px 0 0 0', color: THEME.accentGold, fontWeight: 'bold', fontSize: '16px'}}>{log.calories || 0} kcal</p>
                        <p style={{margin: '5px 0 0 0', fontSize: '13px', color: THEME.textSecondary}}>
                          <span style={{color: THEME.dangerRed}}>P: {log.protein || 0}g</span> | <span style={{color: THEME.macroCarbs}}>C: {log.carbs || 0}g</span> | <span style={{color: THEME.accentGold}}>F: {log.fat || 0}g</span>
                        </p>
                        <p style={{margin: '5px 0 0 0', color: THEME.textSecondary, fontSize: '14px'}}>Body Weight: {log.weight || 'Not logged'} {log.weight ? 'kg' : ''}</p>
                      </div>
                      <button className="mu-button mu-danger-btn" onClick={() => deleteDailyLog(log.id)} style={styles.deleteBtn}><FitnessIcon name="delete" size={15} /> Delete</button>
                    </div>
                  </div>
                  {log.foods && log.foods.length > 0 && (
                    <div style={{marginTop: '10px'}}>
                      {log.foods.map((food, idx) => (
                        <div key={idx} style={styles.historySetRow}>
                          <span style={{fontWeight: 'bold', color: THEME.textSecondary, fontSize: '12px', width: '55px'}}>{food.time}</span>
                          <div style={styles.dottedLine}></div>
                          <div style={{textAlign: 'right'}}>
                            <span style={{color: THEME.textPrimary, fontSize: '14px', display: 'block'}}>{food.name} ({food.weight}g)</span>
                            <span style={{color: THEME.accentGold, fontSize: '13px', fontWeight: 'bold'}}>{food.kcal} kcal</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* AI NUTRITION TAB */}
        {visibleTab === 'food' && (
          <div className="tab-scene screen screen--nutrition" style={{padding: '20px'}}>
            <PageHeader title="Nutrition" description="Capture a meal, review the estimate, and save only what looks right." />

            <div className="panel-card" style={styles.aiMealCard}>
              <div>
                <p style={styles.eyebrow}>Nutrition AI</p>
                <h3 style={styles.aiMealTitle}>AI Meal Scanner</h3>
                <p style={styles.aiMealSubtitle}>Take a photo or describe your meal. Review before saving.</p>
              </div>

              <div style={styles.aiMealModeButtons}>
                <input
                  ref={mealPhotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleMealPhotoFile}
                  style={{display: 'none'}}
                />
                <button
                  className="mu-button mu-main-btn"
                  type="button"
                  onClick={selectMealPhoto}
                  disabled={isAnalyzingMealPhoto || isAnalyzingMealDescription}
                  style={styles.analyzeButton}
                >
                  Scan Meal Photo
                </button>
                <button
                  className="mu-button mu-secondary-btn"
                  type="button"
                  onClick={() => {
                    setAiMealInputMode('description');
                    setAiMealError('');
                    setMealPhotoError('');
                  }}
                  disabled={isAnalyzingMealPhoto || isAnalyzingMealDescription}
                  style={styles.aiMealSecondaryButton}
                >
                  Describe Meal
                </button>
              </div>

              {aiMealInputMode === 'photo' && (
                <div style={styles.aiMealInputPanel}>
                  {mealPhotoPreview ? (
                    <>
                      <img src={mealPhotoPreview} alt="Selected meal" style={styles.aiMealPreviewImage} />
                      <div style={styles.aiMealInlineActions}>
                        <button
                          className="mu-button mu-main-btn"
                          type="button"
                          onClick={analyzeSelectedMealPhoto}
                          disabled={isAnalyzingMealPhoto}
                          style={styles.analyzeButton}
                        >
                          {isAnalyzingMealPhoto ? 'Analyzing Photo...' : 'Analyze Photo'}
                        </button>
                        <button
                          className="mu-button mu-secondary-btn"
                          type="button"
                          onClick={selectMealPhoto}
                          disabled={isAnalyzingMealPhoto}
                          style={styles.aiMealSecondaryButton}
                        >
                          Change Photo
                        </button>
                      </div>
                    </>
                  ) : (
                    <p style={styles.aiMealHint}>Use the button above to take a photo or choose one from your library.</p>
                  )}
                </div>
              )}

              {aiMealInputMode === 'description' && (
                <div style={styles.aiMealInputPanel}>
                  <textarea
                    aria-label="Describe your meal"
                    value={mealDescriptionInput}
                    onChange={(event) => setMealDescriptionInput(event.target.value)}
                    placeholder="Example: 1 bowl of rice, 150g chicken breast, 1 fried egg, vegetables"
                    style={styles.aiMealTextarea}
                  />
                  <button
                    className="mu-button mu-main-btn"
                    type="button"
                    onClick={analyzeEnteredMealDescription}
                    disabled={isAnalyzingMealDescription}
                    style={styles.analyzeButton}
                  >
                    {isAnalyzingMealDescription ? 'Analyzing Description...' : 'Analyze Description'}
                  </button>
                </div>
              )}

              {mealPhotoError && <p role="alert" style={styles.aiMealError}>{mealPhotoError}</p>}
              {aiMealError && (
                <div role="alert" style={styles.aiMealError}>
                  <p style={{margin: 0}}>{aiMealError}</p>
                  {aiMealError.includes('Firebase AI Logic') && (
                    <a
                      href={FIREBASE_AI_SETUP_URL}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.aiMealSetupLink}
                    >
                      Enable Firebase AI Logic
                    </a>
                  )}
                </div>
              )}

              {aiMealResult && (
                <div style={styles.aiMealReviewPanel}>
                  <div style={styles.aiMealReviewHeader}>
                    <div>
                      <p style={styles.eyebrow}>Review Meal</p>
                      <p style={styles.aiMealReviewHint}>Edit any estimate that does not look right.</p>
                    </div>
                    <span
                      style={{
                        ...styles.confidenceBadge,
                        ...(getConfidenceLabel(aiMealResult.confidence) === 'High'
                          ? styles.confidenceHigh
                          : getConfidenceLabel(aiMealResult.confidence) === 'Medium'
                            ? styles.confidenceMedium
                            : styles.confidenceLow),
                      }}
                    >
                      {getConfidenceLabel(aiMealResult.confidence)} confidence
                    </span>
                  </div>

                  <label style={styles.formLabel}>
                    Meal name
                    <input
                      type="text"
                      value={aiMealResult.mealName}
                      onChange={(event) => setAiMealResult(result => ({
                        ...result,
                        mealName: event.target.value,
                      }))}
                      style={{...styles.authInput, marginTop: '8px', marginBottom: 0}}
                    />
                  </label>

                  <div style={styles.macroGrid}>
                    <div style={styles.macroPill}>
                      <strong style={{color: THEME.accentGold}}>{roundNutritionValue(aiMealTotals.kcal)}</strong>
                      <span>kcal</span>
                    </div>
                    <div style={styles.macroPill}>
                      <strong style={{color: THEME.dangerRed}}>{roundNutritionValue(aiMealTotals.protein)}g</strong>
                      <span>Protein</span>
                    </div>
                    <div style={styles.macroPill}>
                      <strong style={{color: THEME.macroCarbs}}>{roundNutritionValue(aiMealTotals.carbs)}g</strong>
                      <span>Carbs</span>
                    </div>
                    <div style={styles.macroPill}>
                      <strong style={{color: THEME.accentGold}}>{roundNutritionValue(aiMealTotals.fat)}g</strong>
                      <span>Fat</span>
                    </div>
                  </div>

                  <div style={styles.aiMealReviewList}>
                    {aiMealReviewItems.map((item, itemIndex) => (
                      <div key={item.reviewId} style={styles.reviewItemCard}>
                        <div style={styles.reviewItemHeader}>
                          <strong>Item {itemIndex + 1}</strong>
                          <div style={styles.reviewItemHeaderActions}>
                            <span style={styles.confidenceBadge}>
                              {getConfidenceLabel(item.confidence)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeAiMealReviewItem(item.reviewId)}
                              style={styles.aiMealRemoveButton}
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <label style={styles.aiMealFieldWide}>
                          <span style={styles.inputLabel}>Food name</span>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(event) => updateAiMealReviewItem(item.reviewId, 'name', event.target.value)}
                            style={{...styles.authInput, padding: '11px', margin: '6px 0 0'}}
                          />
                        </label>

                        <div style={styles.aiMealItemGrid}>
                          {[
                            ['estimatedGrams', 'Grams'],
                            ['kcal', 'kcal'],
                            ['protein', 'Protein'],
                            ['carbs', 'Carbs'],
                            ['fat', 'Fat'],
                          ].map(([field, label]) => (
                            <label key={field}>
                              <span style={styles.inputLabel}>{label}</span>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                inputMode="decimal"
                                value={item[field]}
                                onChange={(event) => updateAiMealReviewItem(item.reviewId, field, event.target.value)}
                                style={{...styles.authInput, padding: '11px', margin: '6px 0 0'}}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    className="mu-button mu-secondary-btn"
                    type="button"
                    onClick={addAiMealReviewItem}
                    style={styles.addAiMealItemButton}
                  >
                    Add Manual Item
                  </button>

                  {aiMealResult.notes && (
                    <p style={styles.aiMealNotes}><strong>Notes:</strong> {aiMealResult.notes}</p>
                  )}

                  <div style={styles.aiMealSaveActions}>
                    <button
                      className="mu-button mu-main-btn"
                      type="button"
                      onClick={saveAiMealToDailyLog}
                      disabled={isSavingAiMeal || aiMealReviewItems.length === 0}
                      style={styles.saveMealButton}
                    >
                      {isSavingAiMeal ? 'Saving Meal...' : 'Save to Today'}
                    </button>
                    <button
                      className="mu-button mu-secondary-btn"
                      type="button"
                      onClick={clearAiMeal}
                      disabled={isSavingAiMeal}
                      style={styles.aiMealSecondaryButton}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              <p style={styles.aiMealDisclaimer}>AI estimates may be inaccurate. Please review before saving.</p>
            </div>
          </div>
        )}

        {/* PROFILE / COACHING TAB */}
        {visibleTab === 'you' && (
          <div className="tab-scene screen screen--profile" style={{padding: '20px', textAlign: 'center'}}>
            <PageHeader title="Coaching profile" description="Set the basics once, then adjust your targets as your body and goals change." />
            <div className="panel-card" style={{...styles.sectionCard, textAlign: 'left'}}>
              
              <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                <div style={{flex: 1}}>
                  <label htmlFor="profile-age" style={styles.inputLabel}>Age</label>
                  <input id="profile-age" type="number" inputMode="numeric" value={profileAge} onChange={(e) => setProfileAge(e.target.value)} style={{...styles.authInput, padding: '10px'}} />
                </div>
                <div style={{flex: 1}}>
                  <label htmlFor="profile-height" style={styles.inputLabel}>Height (cm)</label>
                  <input id="profile-height" type="number" inputMode="decimal" value={profileHeight} onChange={(e) => setProfileHeight(e.target.value)} style={{...styles.authInput, padding: '10px'}} />
                </div>
                <div style={{flex: 1}}>
                  <label htmlFor="profile-weight" style={styles.inputLabel}>Weight (kg)</label>
                  <input id="profile-weight" type="number" inputMode="decimal" value={profileWeight} onChange={(e) => setProfileWeight(e.target.value)} style={{...styles.authInput, padding: '10px'}} />
                </div>
              </div>

              <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                <select aria-label="Gender" value={profileGender} onChange={(e) => setProfileGender(e.target.value)} style={{...styles.authInput, appearance: 'none', padding: '10px', flex: 1}}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <select aria-label="Activity level" value={profileActivity} onChange={(e) => setProfileActivity(e.target.value)} style={{...styles.authInput, appearance: 'none', padding: '10px', flex: 1}}>
                  <option value={1.2}>Sedentary</option>
                  <option value={1.375}>Light Active</option>
                  <option value={1.55}>Moderately Active</option>
                  <option value={1.725}>Very Active</option>
                </select>
              </div>

              <select aria-label="Coaching goal" value={profileGoal} onChange={(e) => setProfileGoal(e.target.value)} style={{...styles.authInput, appearance: 'none', padding: '10px', marginBottom: '15px'}}>
                <option value="cut">Fat Loss (-500 kcal)</option>
                <option value="maintain">Maintenance</option>
                <option value="bulk">Muscle Gain (+300 kcal)</option>
              </select>

              <button className="mu-button mu-main-btn" onClick={calculateCoachingMacros} style={styles.mainBtn}>Generate Plan</button>

              {targetMacros && (
                <div style={styles.macroSummaryCard}>
                  <p style={{textAlign: 'center', color: THEME.accentGold, fontWeight: 'bold', fontSize: '18px', margin: '0 0 10px 0'}}>Target: {targetMacros.kcal} kcal</p>
                  <div style={{display: 'flex', justifyContent: 'space-between', textAlign: 'center'}}>
                    <div>
                      <span style={{color: THEME.dangerRed, display: 'block', fontWeight: 'bold'}}>{targetMacros.protein}g</span>
                      <span style={{color: THEME.textSecondary, fontSize: '12px'}}>Protein</span>
                    </div>
                    <div>
                      <span style={{color: THEME.macroCarbs, display: 'block', fontWeight: 'bold'}}>{targetMacros.carbs}g</span>
                      <span style={{color: THEME.textSecondary, fontSize: '12px'}}>Carbs</span>
                    </div>
                    <div>
                      <span style={{color: THEME.accentGold, display: 'block', fontWeight: 'bold'}}>{targetMacros.fat}g</span>
                      <span style={{color: THEME.textSecondary, fontSize: '12px'}}>Fat</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <h2 style={{fontSize: '24px', marginBottom: '40px'}}>Account Details</h2>
            <div className="panel-card" style={styles.sectionCard}>
              <p style={{color: THEME.textSecondary, margin: '0 0 10px 0'}}>Logged in as:</p>
              <p style={{fontSize: '18px', fontWeight: 'bold', margin: 0}}>{user.email}</p>
            </div>
            <button className="mu-button mu-danger-btn" onClick={handleSignOut} style={{...styles.authButton, backgroundColor: THEME.dangerRed, borderColor: THEME.dangerRed}}>Sign Out</button>
          </div>
        )}
      </main>

      {!isWorkoutActive && (
        <PrimaryNavigation
          items={MAIN_NAV_ITEMS}
          activeTab={activeTab}
          visible={shouldShowBottomNav}
          onSelect={handleTabSelect}
        />
      )}

      {/* EXERCISE MODAL */}
      {showExerciseModal && (
        <div className="modal-surface modal-shell" style={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="exercise-modal-title">
          <div className="modal-header" style={styles.modalHeader}>
            <button type="button" className="mu-icon-button modal-close-button" aria-label="Close exercise picker" onClick={() => { setShowExerciseModal(false); setShowCreateExerciseModal(false); setSelectedExerciseHistoryName(''); }} style={styles.modalClose}><FitnessIcon name="close" size={22} /></button>
            <h2 id="exercise-modal-title" style={{margin: 0, fontSize: '18px'}}>Add exercises</h2>
            <span style={{width: '24px'}}></span>
          </div>

          <ExercisePicker
            exerciseLibrary={allExerciseLibrary}
            searchQuery={exerciseSearchQuery}
            onSearchChange={setExerciseSearchQuery}
            onSelectExercise={(exercise) => addExerciseToWorkout(exercise.exerciseName)}
            onOpenCreateExercise={() => openCreateExerciseModal('workout')}
            showHistoryButton
            onOpenHistory={(event, exercise) => openExerciseHistoryModal(event, exercise.exerciseName)}
            favoriteExercises={favoriteExercises}
            onToggleFavorite={(event, exercise) => toggleFavorite(event, exercise.exerciseName)}
            highlightedExerciseId={lastCreatedExerciseId}
            styles={styles}
            theme={THEME}
          />
        </div>
      )}

      {/* CREATE EXERCISE MODAL */}
      {showCreateExerciseModal && (
        <div className="modal-surface modal-shell modal-shell--top" style={{...styles.modalOverlay, zIndex: 360}} role="dialog" aria-modal="true" aria-labelledby="create-exercise-title">
          <div className="modal-header" style={styles.modalHeader}>
            <span style={{width: '24px'}}></span>
            <h2 id="create-exercise-title" style={{margin: 0, fontSize: '18px'}}>Create exercise</h2>
            <span style={{width: '24px'}}></span>
          </div>

          <div style={styles.createExerciseModalBody}>
            <label htmlFor="new-exercise-name" style={styles.formLabel}>Exercise name</label>
            <input
              id="new-exercise-name"
              type="text"
              placeholder="Smith Machine Incline Press"
              value={newExerciseName}
              onChange={(e) => {
                setNewExerciseName(e.target.value);
                setCreateExerciseError('');
              }}
              style={styles.authInput}
            />

            <label htmlFor="new-exercise-muscle" style={styles.formLabel}>Muscle group</label>
            <select
              id="new-exercise-muscle"
              value={newExerciseMuscleGroup}
              onChange={(e) => {
                setNewExerciseMuscleGroup(e.target.value);
                setCreateExerciseError('');
              }}
              style={{...styles.authInput, appearance: 'none'}}
            >
              <option value="">Select muscle group</option>
              {MUSCLE_GROUP_OPTIONS.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>

            <label htmlFor="new-exercise-notes" style={styles.formLabel}>Notes</label>
            <textarea
              id="new-exercise-notes"
              placeholder="Optional notes..."
              value={newExerciseNotes}
              onChange={(e) => setNewExerciseNotes(e.target.value)}
              style={styles.textAreaField}
            />

            {createExerciseError && (
              <p style={styles.formError}>{createExerciseError}</p>
            )}

            <div style={styles.createExerciseActions}>
	              <button className="mu-button mu-secondary-btn" onClick={closeCreateExerciseModal} style={styles.cancelBtn}>
	                Cancel
	              </button>
	              <button
	                className="mu-button mu-main-btn"
	                onClick={saveCustomExercise}
	                disabled={isSavingCustomExercise}
	                style={{
	                  ...styles.saveExerciseBtn,
	                  opacity: isSavingCustomExercise ? 0.55 : 1,
	                  cursor: isSavingCustomExercise ? 'not-allowed' : 'pointer',
	                }}
	              >
	                {isSavingCustomExercise ? 'Saving...' : 'Save Exercise'}
	              </button>
	            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT TEMPLATE MODAL */}
	      {showTemplateModal && (
	        <div className="modal-surface modal-shell" style={{...styles.modalOverlay, zIndex: 340}} role="dialog" aria-modal="true" aria-labelledby="template-modal-title">
          <div className="modal-header" style={styles.modalHeader}>
            <button type="button" className="mu-icon-button modal-close-button" aria-label="Close template editor" onClick={closeTemplateModal} style={styles.modalClose}><FitnessIcon name="close" size={22} /></button>
            <h2 id="template-modal-title" style={{margin: 0, fontSize: '18px'}}>{editingTemplateId ? 'Edit template' : 'Create template'}</h2>
            <span style={{width: '24px'}}></span>
          </div>

          <div style={styles.templateModalBody}>
            <label htmlFor="template-name" style={styles.formLabel}>Template name</label>
            <input
              id="template-name"
              type="text"
              placeholder="Push Day"
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value);
                setTemplateFormError('');
              }}
              style={styles.authInput}
            />

            <label htmlFor="template-notes" style={styles.formLabel}>Notes</label>
            <textarea
              id="template-notes"
              placeholder="Optional notes..."
              value={templateNotes}
              onChange={(e) => setTemplateNotes(e.target.value)}
              style={styles.textAreaField}
            />

            <div style={styles.templateLibraryPanel}>
              <div style={styles.templateLibraryHeader}>
                <h3 style={styles.templateSubTitle}>Add Exercise</h3>
              </div>
              <ExercisePicker
                exerciseLibrary={allExerciseLibrary}
                searchQuery={templateExerciseSearch}
                onSearchChange={setTemplateExerciseSearch}
                onSelectExercise={addExerciseToTemplate}
                onOpenCreateExercise={() => openCreateExerciseModal('template')}
                isExerciseSelected={(exercise) => templateExercises.some(templateExercise =>
                  templateExercise.exerciseName.toLowerCase() === exercise.exerciseName.toLowerCase() &&
                  templateExercise.muscleGroup === exercise.muscleGroup
                )}
                getSelectLabel={(_, selected) => selected ? 'Added' : 'Add'}
                highlightedExerciseId={lastCreatedExerciseId}
                compact
                styles={styles}
                theme={THEME}
              />
            </div>

            <div style={styles.templateExerciseEditorHeader}>
              <h3 style={styles.templateSubTitle}>Selected Exercises:</h3>
              <span style={styles.templateExerciseCount}>{templateExercises.length} exercises</span>
            </div>

            {templateExercises.length === 0 ? (
              <div style={styles.templateEmptyState}>
                <p style={{margin: 0, color: THEME.textSecondary}}>Add at least one exercise to build this template.</p>
              </div>
            ) : (
              <div style={styles.templateExerciseEditorList}>
                {templateExercises.map((exercise, index) => (
                  <div
                    key={`${exercise.exerciseId}-${index}`}
                    draggable
                    onDragStart={() => { templateDragIndexRef.current = index; }}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.outline = `2px solid ${THEME.accentGold}`; e.currentTarget.style.outlineOffset = '2px'; }}
                    onDragLeave={(e) => { e.currentTarget.style.outline = 'none'; }}
                    onDrop={(e) => {
                      e.currentTarget.style.outline = 'none';
                      if (templateDragIndexRef.current !== null && templateDragIndexRef.current !== index) {
                        moveTemplateExercise(templateDragIndexRef.current, index);
                      }
                      templateDragIndexRef.current = null;
                    }}
                    onDragEnd={(e) => { e.currentTarget.style.outline = 'none'; templateDragIndexRef.current = null; }}
                    style={styles.templateExerciseEditorCard}
                  >
                    <div style={styles.templateExerciseEditorTop}>
                      <div style={styles.templateDragHandle} title="Drag to reorder" aria-hidden="true">
                        <svg width="14" height="22" viewBox="0 0 14 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="3" cy="4" r="2" fill="currentColor"/><circle cx="11" cy="4" r="2" fill="currentColor"/>
                          <circle cx="3" cy="11" r="2" fill="currentColor"/><circle cx="11" cy="11" r="2" fill="currentColor"/>
                          <circle cx="3" cy="18" r="2" fill="currentColor"/><circle cx="11" cy="18" r="2" fill="currentColor"/>
                        </svg>
                      </div>
                      <div style={{minWidth: 0, flex: 1}}>
                        <h4 style={styles.templateExerciseEditorTitle}>{index + 1}. {exercise.exerciseName}</h4>
                        <p style={styles.templateExerciseEditorGroup}>{exercise.muscleGroup}</p>
                      </div>
                      <div style={styles.templateReorderButtons}>
                        <button
                          type="button"
                          className="mu-icon-button"
                          onClick={() => moveTemplateExercise(index, index - 1)}
                          disabled={index === 0}
                          style={{ ...styles.templateReorderBtn, opacity: index === 0 ? 0.3 : 1 }}
                          aria-label={`Move ${exercise.exerciseName} up`}
                          title="Move up"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2L1 8h10L6 2z" fill="currentColor"/></svg>
                        </button>
                        <button
                          type="button"
                          className="mu-icon-button"
                          onClick={() => moveTemplateExercise(index, index + 1)}
                          disabled={index === templateExercises.length - 1}
                          style={{ ...styles.templateReorderBtn, opacity: index === templateExercises.length - 1 ? 0.3 : 1 }}
                          aria-label={`Move ${exercise.exerciseName} down`}
                          title="Move down"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 10L11 4H1l5 6z" fill="currentColor"/></svg>
                        </button>
                      </div>
                      <button className="mu-button mu-danger-btn" onClick={() => removeTemplateExercise(index)} style={styles.templateRemoveBtn}>
                        Remove
                      </button>
                    </div>

                    <div style={styles.templateExerciseFields}>
                      <div>
                        <label style={styles.inputLabel}>Number of sets</label>
                        <input
                          type="number"
                          min="1"
                          value={(exercise.sets || []).length}
                          onChange={(e) => updateTemplateExerciseSetCount(index, e.target.value)}
                          style={{...styles.authInput, marginBottom: 0, padding: '11px'}}
                        />
                      </div>
                      <div>
                        <label style={styles.inputLabel}>Reps per set</label>
                        <input
                          type="text"
                          placeholder="8"
                          value={getUniformSetValue(exercise.sets, 'reps')}
                          onChange={(e) => updateTemplateExerciseSetValue(index, 'reps', e.target.value)}
                          style={{...styles.authInput, marginBottom: 0, padding: '11px'}}
                        />
                      </div>
                      <div>
                        <label style={styles.inputLabel}>Optional weight</label>
                        <input
                          type="text"
                          placeholder="Optional"
                          value={getUniformSetValue(exercise.sets, 'weight')}
                          onChange={(e) => updateTemplateExerciseSetValue(index, 'weight', e.target.value)}
                          style={{...styles.authInput, marginBottom: 0, padding: '11px'}}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {templateFormError && (
              <p style={styles.formError}>{templateFormError}</p>
            )}

            <div style={styles.templateModalActions}>
              <button className="mu-button mu-secondary-btn" onClick={closeTemplateModal} style={styles.cancelBtn}>
                Cancel
              </button>
	              <button
	                className="mu-button mu-main-btn"
	                onClick={saveWorkoutTemplate}
	                disabled={isSavingTemplate}
	                style={{
	                  ...styles.saveExerciseBtn,
	                  opacity: isSavingTemplate ? 0.55 : 1,
	                  cursor: isSavingTemplate ? 'not-allowed' : 'pointer',
	                }}
	              >
	                {isSavingTemplate ? 'Saving...' : 'Save Template'}
	              </button>
            </div>
          </div>
	        </div>
	      )}

	      {/* IMPORT TEMPLATE FROM IMAGE MODAL */}
	      {showImportTemplateModal && (
	        <div className="modal-surface modal-shell" style={{...styles.modalOverlay, zIndex: 340}} role="dialog" aria-modal="true" aria-labelledby="import-template-title">
	          <div className="modal-header" style={styles.modalHeader}>
	            <button type="button" className="mu-icon-button modal-close-button" aria-label="Close template import" onClick={closeImportTemplateModal} style={styles.modalClose}><FitnessIcon name="close" size={22} /></button>
	            <h2 id="import-template-title" style={{margin: 0, fontSize: '18px'}}>Import template</h2>
	            <span style={{width: '24px'}}></span>
	          </div>

	          <div style={styles.importTemplateModalBody}>
	            <div style={styles.importUploadPanel}>
	              <div style={styles.importUploadTop}>
	                <label className="mu-button mu-secondary-btn" style={styles.uploadImageButton}>
	                  Upload image
	                  <input
	                    type="file"
	                    accept="image/png,image/jpeg,image/jpg,image/webp"
	                    onChange={handleImportImageChange}
	                    style={{display: 'none'}}
	                  />
	                </label>
	                <button
	                  className="mu-button mu-main-btn"
	                  onClick={parseImportedTemplateImage}
	                  disabled={!importImageBase64 || isParsingTemplateImage}
	                  style={{
	                    ...styles.parseImageBtn,
	                    opacity: !importImageBase64 || isParsingTemplateImage ? 0.5 : 1,
	                  }}
	                >
	                  {isParsingTemplateImage ? 'Parsing...' : 'Parse Image'}
	                </button>
	              </div>
	              <p style={styles.importHint}>PNG, JPG, JPEG, or WEBP. Max 5MB. Parsing starts only after Parse Image.</p>
	              {importImageFileName && (
	                <p style={styles.importFileName}>{importImageFileName}</p>
	              )}
	              {importImagePreview && (
	                <div style={styles.importImagePreviewWrap}>
	                  <img src={importImagePreview} alt="Uploaded workout template preview" style={styles.importImagePreview} />
	                </div>
	              )}
	              {isParsingTemplateImage && (
	                <div style={styles.importLoadingState}>Analyzing image...</div>
	              )}
	              {importTemplateError && (
	                <p style={styles.formError}>{importTemplateError}</p>
	              )}
	            </div>

	            {hasParsedImport && (
	              <div style={styles.importReviewPanel}>
	                <h3 style={styles.templateSubTitle}>Review Imported Template</h3>
	                <label style={{...styles.formLabel, marginTop: '16px'}}>Template name</label>
	                <input
	                  type="text"
	                  value={importedTemplateName}
	                  onChange={(event) => {
	                    setImportedTemplateName(event.target.value);
	                    setImportTemplateError('');
	                  }}
	                  style={styles.authInput}
	                />

	                <div style={styles.templateLibraryPanel}>
	                  <div style={styles.templateLibraryHeader}>
	                    <h3 style={styles.templateSubTitle}>Add missing exercise</h3>
	                  </div>
	                  <ExercisePicker
	                    exerciseLibrary={allExerciseLibrary}
	                    searchQuery={importExerciseSearch}
	                    onSearchChange={setImportExerciseSearch}
	                    onSelectExercise={addExerciseToImportedTemplate}
	                    onOpenCreateExercise={() => openCreateExerciseModal('import')}
	                    isExerciseSelected={(exercise) => importedTemplateExercises.some(importedExercise =>
	                      importedExercise.exerciseName.toLowerCase() === exercise.exerciseName.toLowerCase() &&
	                      importedExercise.muscleGroup === exercise.muscleGroup
	                    )}
	                    getSelectLabel={(_, selected) => selected ? 'Added' : 'Add'}
	                    highlightedExerciseId={lastCreatedExerciseId}
	                    compact
	                    styles={styles}
	                    theme={THEME}
	                  />
	                </div>

	                <div style={styles.templateExerciseEditorHeader}>
	                  <h3 style={styles.templateSubTitle}>Exercises:</h3>
	                  <span style={styles.templateExerciseCount}>{importedTemplateExercises.length} exercises</span>
	                </div>

	                {importedTemplateExercises.length === 0 ? (
	                  <div style={styles.importEmptyState}>
	                    <p style={{margin: 0, color: THEME.textSecondary}}>No exercises were detected in this image. Try a clearer image or enter the template manually.</p>
	                  </div>
	                ) : (
	                  <div style={styles.importReviewList}>
	                    {importedTemplateExercises.map((exercise, index) => {
	                      const confidenceLabel = getConfidenceLabel(exercise.confidence);
	                      const isLowConfidence = confidenceLabel === 'Low';

	                      return (
	                        <div key={`${exercise.exerciseId}-${index}`} style={styles.importReviewCard}>
	                          <div style={styles.importReviewCardTop}>
	                            <div style={{minWidth: 0}}>
	                              <h4 style={styles.templateExerciseEditorTitle}>{index + 1}. {exercise.exerciseName || 'Unnamed exercise'}</h4>
	                              <div style={styles.importBadges}>
	                                <span style={styles.importConfidenceBadge}>Confidence: {confidenceLabel}</span>
	                                {exercise.isNewExercise && <span style={styles.importNewBadge}>New exercise</span>}
	                              </div>
	                              {isLowConfidence && (
	                                <p style={styles.importReviewWarning}>Please review this item.</p>
	                              )}
	                            </div>
	                            <button className="mu-button mu-danger-btn" onClick={() => removeImportedTemplateExercise(index)} style={styles.templateRemoveBtn}>
	                              Remove
	                            </button>
	                          </div>

	                          <div style={styles.importReviewFields}>
	                            <div style={styles.importFieldWide}>
	                              <label style={styles.inputLabel}>Exercise name</label>
	                              <input
	                                type="text"
	                                value={exercise.exerciseName}
	                                onChange={(event) => updateImportedTemplateExercise(index, 'exerciseName', event.target.value)}
	                                style={{...styles.authInput, marginBottom: 0, padding: '11px'}}
	                              />
	                            </div>
	                            <div>
	                              <label style={styles.inputLabel}>Muscle group</label>
	                              <select
	                                value={exercise.muscleGroup}
	                                onChange={(event) => updateImportedTemplateExercise(index, 'muscleGroup', event.target.value)}
	                                style={{...styles.authInput, marginBottom: 0, padding: '11px', appearance: 'none'}}
	                              >
	                                {MUSCLE_GROUP_OPTIONS.map(group => (
	                                  <option key={group} value={group}>{group}</option>
	                                ))}
	                              </select>
	                            </div>
	                            <div>
	                              <label style={styles.inputLabel}>Sets</label>
	                              <input
	                                type="number"
	                                min="1"
	                                value={exercise.setCount}
	                                onChange={(event) => updateImportedTemplateExercise(index, 'setCount', event.target.value)}
	                                style={{...styles.authInput, marginBottom: 0, padding: '11px'}}
	                              />
	                            </div>
	                            <div>
	                              <label style={styles.inputLabel}>Reps</label>
	                              <input
	                                type="text"
	                                value={exercise.reps}
	                                onChange={(event) => updateImportedTemplateExercise(index, 'reps', event.target.value)}
	                                style={{...styles.authInput, marginBottom: 0, padding: '11px'}}
	                              />
	                            </div>
	                            <div>
	                              <label style={styles.inputLabel}>Weight</label>
	                              <input
	                                type="text"
	                                placeholder="Optional"
	                                value={exercise.weight}
	                                onChange={(event) => updateImportedTemplateExercise(index, 'weight', event.target.value)}
	                                style={{...styles.authInput, marginBottom: 0, padding: '11px'}}
	                              />
	                            </div>
	                            <div style={styles.importFieldWide}>
	                              <label style={styles.inputLabel}>Notes</label>
	                              <input
	                                type="text"
	                                value={exercise.notes}
	                                onChange={(event) => updateImportedTemplateExercise(index, 'notes', event.target.value)}
	                                style={{...styles.authInput, marginBottom: 0, padding: '11px'}}
	                              />
	                            </div>
	                          </div>
	                        </div>
	                      );
	                    })}
	                  </div>
	                )}

	                <div style={styles.templateModalActions}>
	                  <button className="mu-button mu-secondary-btn" onClick={closeImportTemplateModal} style={styles.cancelBtn}>
	                    Cancel
	                  </button>
	                  <button
	                    className="mu-button mu-main-btn"
	                    onClick={saveImportedTemplate}
	                    disabled={!canSaveImportedTemplate || isSavingImportedTemplate}
	                    style={{
	                      ...styles.saveExerciseBtn,
	                      opacity: canSaveImportedTemplate && !isSavingImportedTemplate ? 1 : 0.5,
	                      cursor: canSaveImportedTemplate && !isSavingImportedTemplate ? 'pointer' : 'not-allowed',
	                    }}
	                  >
	                    {isSavingImportedTemplate ? 'Saving...' : 'Save Template'}
	                  </button>
	                </div>
	              </div>
	            )}
	          </div>
	        </div>
	      )}

	      {/* EXERCISE HISTORY MODAL */}
      {selectedExerciseHistoryName && (
        <div style={styles.exerciseHistoryOverlay}>
          <div className="modal-surface modal-shell" style={styles.exerciseHistoryModal} role="dialog" aria-modal="true" aria-labelledby="exercise-history-title">
            <div className="modal-header" style={styles.modalHeader}>
              <button type="button" className="mu-icon-button modal-close-button" aria-label="Close exercise history" onClick={() => setSelectedExerciseHistoryName('')} style={styles.modalClose}><FitnessIcon name="close" size={22} /></button>
              <h2 id="exercise-history-title" style={{margin: 0, fontSize: '18px'}}>Exercise history: {selectedExerciseHistoryName}</h2>
              <span style={{width: '24px'}}></span>
            </div>

            <div style={styles.exerciseHistoryModalBody}>
              {selectedExerciseHistory.length === 0 ? (
                <div style={styles.exerciseHistoryEmptyState}>
                  <p style={styles.exerciseHistoryEmptyTitle}>No history for this exercise yet.</p>
                  <p style={styles.exerciseHistoryEmptyText}>Start a workout and complete this exercise to build history.</p>
                </div>
              ) : (
                <>
                  <div style={styles.exerciseHistoryStatsGrid}>
                    <div style={styles.exerciseHistoryStatCard}>
                      <span style={styles.exerciseHistoryStatLabel}>Best Set:</span>
                      <strong style={styles.exerciseHistoryStatValue}>
                        {selectedExerciseBestSet
                          ? `${formatHistoryMetric(selectedExerciseBestSet.weight)} kg × ${formatHistoryMetric(selectedExerciseBestSet.reps)} reps`
                          : '— kg × — reps'}
                      </strong>
                    </div>
                    <div style={styles.exerciseHistoryStatCard}>
                      <span style={styles.exerciseHistoryStatLabel}>Last Performed:</span>
                      <strong style={styles.exerciseHistoryStatValue}>{selectedExerciseHistory[0]?.date || 'Unknown date'}</strong>
                    </div>
                    <div style={styles.exerciseHistoryStatCard}>
                      <span style={styles.exerciseHistoryStatLabel}>Total Sessions:</span>
                      <strong style={styles.exerciseHistoryStatValue}>{selectedExerciseHistory.length}</strong>
                    </div>
                  </div>

                  <h3 style={styles.exerciseHistorySectionTitle}>Session History:</h3>
                  <div style={styles.exerciseHistorySessionList}>
                    {selectedExerciseHistory.map((session, sessionIndex) => (
                      <div key={`${session.date}-${sessionIndex}`} style={styles.exerciseHistorySessionCard}>
                        <div style={styles.exerciseHistorySessionHeader}>
                          <div>
                            <h4 style={styles.exerciseHistorySessionDate}>{session.date || 'Unknown date'}</h4>
                            <p style={styles.exerciseHistoryExerciseName}>{selectedExerciseHistoryName}</p>
                          </div>
                          {session.duration && <span style={styles.exerciseHistoryDuration}>{session.duration}</span>}
                        </div>

                        {session.sets.map(set => {
                          const weightText = set.weight ? `${set.weight} kg` : '— kg';
                          const repsText = set.reps ? `${set.reps} reps` : '— reps';

                          return (
                            <div key={`${session.date}-${set.setNumber}`} style={styles.exerciseHistorySetRow}>
                              <span style={styles.exerciseHistorySetLabel}>Set {set.setNumber}:</span>
                              <span style={styles.exerciseHistorySetValue}>{weightText} × {repsText}</span>
                              {typeof set.completed === 'boolean' && (
                                <span style={{
                                  ...styles.exerciseHistoryCompletedBadge,
                                  color: set.completed ? THEME.successGreen : THEME.textSecondary,
                                  borderColor: set.completed ? 'rgba(52, 199, 89, 0.34)' : THEME.border,
                                  backgroundColor: set.completed ? THEME.successSoft : THEME.bgDark,
                                  gridColumn: '2 / -1',
                                  justifySelf: 'flex-start',
                                }}>
                                  {set.completed ? 'Completed' : 'Not completed'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// 3. DESIGN SYSTEM 
const styles = {
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '480px',
    height: '100dvh',
    minHeight: '100dvh',
    overflow: 'hidden',
    margin: '0 auto',
    background:
      'radial-gradient(circle at 18% -8%, rgba(218, 41, 28, 0.22), transparent 34%), radial-gradient(circle at 92% 4%, rgba(242, 201, 76, 0.10), transparent 30%), linear-gradient(180deg, #08080A 0%, #050506 50%, #0A0A0D 100%)',
    color: THEME.textPrimary,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
  },
  contentScroll: {
    flex: 1,
    height: '100dvh',
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: 'calc(168px + env(safe-area-inset-bottom))',
    scrollPaddingBottom: 'calc(168px + env(safe-area-inset-bottom))',
    minHeight: 0,
    minWidth: 0,
  },
  loadingPanel: {
    width: 'min(100% - 40px, 360px)',
    padding: 'calc(22px + env(safe-area-inset-top)) 20px 24px',
    textAlign: 'center',
  },
  loadingText: {
    margin: 0,
    color: THEME.textSecondary,
    fontSize: '15px',
    fontWeight: '800',
  },
  tabSkeleton: {
    padding: '20px',
    display: 'grid',
    gap: '14px',
  },
  tabSkeletonTitle: {
    width: '48%',
    height: '24px',
    borderRadius: '12px',
  },
  tabSkeletonBlock: {
    width: '100%',
    height: '112px',
    borderRadius: '20px',
  },
  authTitle: {
    color: THEME.textPrimary,
    fontSize: 'clamp(38px, 8vw, 64px)',
    margin: '0 0 28px 0',
    fontWeight: '900',
    letterSpacing: '0',
    textAlign: 'center',
    textShadow: '0 18px 42px rgba(0, 0, 0, 0.52)',
  },
  authInput: {
    width: '100%',
    padding: '15px 16px',
    marginBottom: '15px',
    backgroundColor: 'rgba(255, 255, 255, 0.065)',
    color: THEME.textPrimary,
    border: `1px solid ${THEME.border}`,
    borderRadius: '16px',
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    transition: 'border-color 0.26s cubic-bezier(.2,.8,.2,1), box-shadow 0.26s cubic-bezier(.2,.8,.2,1), background-color 0.26s cubic-bezier(.2,.8,.2,1)',
  },
  authButton: {
    width: '100%',
    padding: '15px 18px',
    backgroundColor: THEME.primaryRed,
    color: THEME.textPrimary,
    border: `1px solid ${THEME.primaryRed}`,
    borderRadius: '18px',
    fontSize: '16px',
    fontWeight: '900',
    cursor: 'pointer',
    boxShadow: '0 20px 44px rgba(218, 41, 28, 0.28)',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    color: THEME.textPrimary,
    border: `1px solid ${THEME.border}`,
    boxShadow: 'none',
  },
  timerText: {
    fontSize: 'clamp(56px, 14vw, 86px)',
    fontWeight: '900',
    textAlign: 'center',
    margin: '18px 0 30px 0',
    color: THEME.textPrimary,
    letterSpacing: '0',
    textShadow: '0 0 34px rgba(218, 41, 28, 0.46)',
    animation: 'pulseGlow 2.8s ease-in-out infinite',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0 22px 14px',
    paddingTop: 'calc(12px + env(safe-area-inset-top))',
    alignItems: 'center',
    gap: '16px',
    borderBottom: `1px solid rgba(255, 255, 255, 0.10)`,
    background: 'rgba(5, 5, 6, 0.94)',
    backdropFilter: 'blur(18px)',
    position: 'sticky',
    top: 0,
    zIndex: 200,
    boxShadow: '0 18px 34px rgba(0, 0, 0, 0.28)',
  },
  topBarDiscardButton: {
    width: '48px',
    height: '48px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: THEME.textSecondary,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '50%',
    fontSize: '19px',
    lineHeight: 1,
    cursor: 'pointer',
  },
  topBarFinishButton: {
    minWidth: '108px',
    minHeight: '48px',
    padding: '0 22px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: THEME.textPrimary,
    background: 'linear-gradient(135deg, #FF3B30 0%, #DA291C 100%)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '999px',
    fontSize: '16px',
    fontWeight: '900',
    cursor: 'pointer',
    boxShadow: '0 16px 32px rgba(218, 41, 28, 0.28)',
  },
  mainBtn: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #FF3B30 0%, #DA291C 52%, #9F160F 100%)',
    color: THEME.textPrimary,
    borderRadius: '999px',
    fontWeight: '900',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    fontSize: '16px',
    cursor: 'pointer',
    boxShadow: '0 20px 44px rgba(218, 41, 28, 0.28)',
  },
  discardBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: 'rgba(255, 69, 58, 0.10)',
    color: THEME.dangerRed,
    borderRadius: '999px',
    fontWeight: '900',
    border: `1px solid rgba(255, 69, 58, 0.24)`,
    fontSize: '16px',
    cursor: 'pointer',
  },
  deleteBtn: {
    backgroundColor: THEME.dangerSoft,
    color: THEME.dangerRed,
    border: `1px solid rgba(255, 69, 58, 0.24)`,
    borderRadius: '999px',
    padding: '8px 12px',
    fontSize: '14px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  calendarContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    background: 'rgba(255, 255, 255, 0.055)',
    padding: '12px',
    borderRadius: '22px',
    marginBottom: '22px',
    border: `1px solid ${THEME.border}`,
    boxShadow: THEME.shadow,
    backdropFilter: 'blur(14px)',
  },
  calendarDay: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minWidth: '38px', height: '58px', borderRadius: '16px' },
  historyCard: {
    background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.04))',
    padding: '20px',
    borderRadius: '24px',
    marginBottom: '16px',
    border: `1px solid ${THEME.border}`,
    boxShadow: THEME.shadow,
    backdropFilter: 'blur(16px)',
  },
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: `1px solid ${THEME.border}`,
    paddingBottom: '15px',
    marginBottom: '15px',
    gap: '16px',
  },

  globalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'calc(12px + env(safe-area-inset-top)) clamp(16px, 3vw, 26px) 14px',
    margin: '0 clamp(10px, 2vw, 18px) 0',
    background: 'rgba(14, 15, 18, 0.72)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '24px',
    zIndex: 40,
    position: 'sticky',
    top: 0,
    boxShadow: '0 18px 42px rgba(0, 0, 0, 0.38)',
  },
  brandTitle: {
    margin: 0,
    fontSize: '22px',
    color: THEME.textPrimary,
    fontWeight: '900',
    letterSpacing: '0',
    display: 'inline-flex',
    flexDirection: 'column',
    lineHeight: 1.05,
    gap: '5px',
  },
  brandMarker: {
    width: '62px',
    height: '4px',
    borderRadius: '999px',
    background: `linear-gradient(90deg, ${THEME.primaryRed}, ${THEME.accentGold})`,
    boxShadow: '0 0 14px rgba(218, 41, 28, 0.55)',
  },
  headerProfileChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '44px',
    padding: '6px 7px 6px 12px',
    color: THEME.textSecondary,
    background: 'rgba(255, 255, 255, 0.065)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '999px',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  headerProfileInitial: {
    width: '32px',
    height: '32px',
    display: 'inline-grid',
    placeItems: 'center',
    color: THEME.textPrimary,
    background: `linear-gradient(135deg, ${THEME.primaryRedHover}, ${THEME.primaryRed})`,
    borderRadius: '50%',
    fontSize: '13px',
    fontWeight: '900',
  },

  pageTitle: {
    fontSize: 'clamp(28px, 6vw, 42px)',
    margin: '4px 0 24px 0',
    textAlign: 'center',
    color: THEME.textPrimary,
    fontWeight: '900',
    letterSpacing: '0',
  },
  workoutHome: {
    padding: 'clamp(18px, 4vw, 30px) clamp(14px, 4vw, 30px) 38px',
  },
  startPanel: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: '260px',
    padding: '32px min(36vw, 190px) 32px clamp(22px, 5vw, 42px)',
    textAlign: 'left',
    background:
      'linear-gradient(135deg, rgba(218, 41, 28, 0.30), rgba(255, 255, 255, 0.075) 42%, rgba(242, 201, 76, 0.10)), linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.035))',
    border: `1px solid ${THEME.border}`,
    borderRadius: '32px',
    boxShadow: THEME.shadow,
    marginBottom: '28px',
    backdropFilter: 'blur(18px)',
  },
  eyebrow: {
    color: THEME.accentGold,
    fontSize: '12px',
    fontWeight: '900',
    letterSpacing: '1.4px',
    margin: '0 0 10px 0',
    textTransform: 'uppercase',
  },
  dashboardCard: {
    background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.095), rgba(255, 255, 255, 0.04))',
    padding: '24px',
    borderRadius: '26px',
    marginBottom: '30px',
    textAlign: 'center',
    border: `1px solid ${THEME.border}`,
    boxShadow: THEME.shadow,
    backdropFilter: 'blur(16px)',
  },
  sectionCard: {
    background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.038))',
    padding: '20px',
    borderRadius: '24px',
    marginBottom: '30px',
    border: `1px solid ${THEME.border}`,
    boxShadow: THEME.shadow,
    backdropFilter: 'blur(16px)',
    minWidth: 0,
  },
  aiMealCard: {
    background:
      'linear-gradient(155deg, rgba(218, 41, 28, 0.20), rgba(255, 255, 255, 0.075) 42%, rgba(242, 201, 76, 0.08))',
    padding: '20px',
    borderRadius: '26px',
    marginBottom: '24px',
    border: `1px solid ${THEME.border}`,
    boxShadow: THEME.shadow,
    backdropFilter: 'blur(16px)',
    minWidth: 0,
    overflow: 'hidden',
  },
  aiMealTitle: {
    margin: 0,
    color: THEME.textPrimary,
    fontSize: '22px',
    fontWeight: '900',
  },
  aiMealSubtitle: {
    margin: '8px 0 0',
    color: THEME.textSecondary,
    fontSize: '14px',
    lineHeight: 1.5,
  },
  aiMealModeButtons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '10px',
    marginTop: '18px',
  },
  aiMealInputPanel: {
    display: 'grid',
    gap: '12px',
    marginTop: '16px',
    padding: '14px',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '20px',
    minWidth: 0,
  },
  aiMealPreviewImage: {
    display: 'block',
    width: '100%',
    maxHeight: '320px',
    objectFit: 'cover',
    borderRadius: '16px',
    border: `1px solid ${THEME.border}`,
    backgroundColor: THEME.bgBlack,
  },
  aiMealTextarea: {
    width: '100%',
    minHeight: '118px',
    padding: '14px',
    color: THEME.textPrimary,
    backgroundColor: 'rgba(255, 255, 255, 0.065)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '16px',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    fontSize: '15px',
    lineHeight: 1.5,
  },
  aiMealInlineActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '10px',
  },
  aiMealHint: {
    margin: 0,
    color: THEME.textSecondary,
    fontSize: '13px',
    lineHeight: 1.5,
    textAlign: 'center',
  },
  aiMealError: {
    margin: '14px 0 0',
    padding: '12px',
    color: THEME.dangerRed,
    backgroundColor: THEME.dangerSoft,
    border: '1px solid rgba(255, 69, 58, 0.24)',
    borderRadius: '14px',
    fontSize: '13px',
    fontWeight: '800',
    lineHeight: 1.45,
  },
  aiMealSetupLink: {
    display: 'inline-block',
    marginTop: '8px',
    color: THEME.textPrimary,
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
  },
  aiMealReviewPanel: {
    marginTop: '18px',
    paddingTop: '18px',
    borderTop: `1px solid ${THEME.border}`,
  },
  aiMealReviewHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '16px',
  },
  aiMealReviewHint: {
    margin: 0,
    color: THEME.textSecondary,
    fontSize: '13px',
  },
  macroGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
    margin: '16px 0',
  },
  macroPill: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '8px',
    minWidth: 0,
    padding: '11px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '14px',
    color: THEME.textSecondary,
    fontSize: '12px',
  },
  aiMealReviewList: {
    display: 'grid',
    gap: '12px',
  },
  reviewItemCard: {
    minWidth: 0,
    padding: '14px',
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '20px',
  },
  reviewItemHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '12px',
  },
  reviewItemHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '7px',
    flexWrap: 'wrap',
  },
  aiMealFieldWide: {
    display: 'block',
    minWidth: 0,
  },
  aiMealItemGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
    marginTop: '10px',
  },
  confidenceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: '5px 8px',
    color: THEME.textSecondary,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  confidenceHigh: {
    color: THEME.successGreen,
    backgroundColor: THEME.successSoft,
    borderColor: 'rgba(53, 208, 127, 0.30)',
  },
  confidenceMedium: {
    color: THEME.accentGold,
    backgroundColor: THEME.goldSoft,
    borderColor: 'rgba(242, 201, 76, 0.30)',
  },
  confidenceLow: {
    color: THEME.dangerRed,
    backgroundColor: THEME.dangerSoft,
    borderColor: 'rgba(255, 69, 58, 0.28)',
  },
  analyzeButton: {
    width: '100%',
    minHeight: '46px',
    padding: '12px 14px',
    color: THEME.textPrimary,
    background: 'linear-gradient(135deg, #FF3B30, #DA291C)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '999px',
    fontSize: '14px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  aiMealSecondaryButton: {
    width: '100%',
    minHeight: '46px',
    padding: '12px 14px',
    color: THEME.textPrimary,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '999px',
    fontSize: '14px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  aiMealRemoveButton: {
    padding: '6px 9px',
    color: THEME.dangerRed,
    backgroundColor: THEME.dangerSoft,
    border: '1px solid rgba(255, 69, 58, 0.24)',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  addAiMealItemButton: {
    width: '100%',
    marginTop: '12px',
    padding: '12px',
    color: THEME.accentGold,
    backgroundColor: THEME.goldSoft,
    border: '1px solid rgba(242, 201, 76, 0.28)',
    borderRadius: '999px',
    fontSize: '14px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  aiMealNotes: {
    margin: '14px 0 0',
    padding: '12px',
    color: THEME.textSecondary,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '14px',
    fontSize: '12px',
    lineHeight: 1.5,
  },
  aiMealSaveActions: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.8fr)',
    gap: '10px',
    marginTop: '16px',
    paddingBottom: '8px',
  },
  saveMealButton: {
    width: '100%',
    minHeight: '48px',
    padding: '13px 14px',
    color: THEME.textPrimary,
    background: 'linear-gradient(135deg, #35D07F, #178E52)',
    border: '1px solid rgba(53, 208, 127, 0.40)',
    borderRadius: '999px',
    fontSize: '14px',
    fontWeight: '900',
    cursor: 'pointer',
    boxShadow: '0 16px 34px rgba(53, 208, 127, 0.18)',
  },
  aiMealDisclaimer: {
    margin: '16px 0 0',
    color: THEME.textSecondary,
    fontSize: '11px',
    lineHeight: 1.45,
    textAlign: 'center',
  },
  chartFrame: {
    width: '100%',
    minWidth: 0,
    height: CHART_HEIGHT,
    minHeight: CHART_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  inputLabel: { fontSize: '12px', color: THEME.textSecondary, fontWeight: '700' },
  formLabel: { display: 'block', margin: '0 0 8px 0', color: THEME.textPrimary, fontSize: '14px', fontWeight: '800' },
  macroSummaryCard: {
    marginTop: '20px',
    padding: '18px',
    background: 'rgba(242, 201, 76, 0.08)',
    borderRadius: '20px',
    border: `1px solid rgba(242, 201, 76, 0.38)`,
  },
  templateSection: {
    marginTop: '8px',
  },
  templateSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '14px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  templateHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },
  templateSectionTitle: {
    margin: 0,
    color: THEME.textPrimary,
    fontSize: '26px',
    fontWeight: '900',
  },
  createTemplateBtn: {
    backgroundColor: 'rgba(218, 41, 28, 0.16)',
    color: THEME.textPrimary,
    border: `1px solid ${THEME.redMedium}`,
    borderRadius: '999px',
    padding: '11px 15px',
    fontSize: '14px',
    fontWeight: '900',
    cursor: 'pointer',
    flexShrink: 0,
  },
  importTemplateBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.065)',
    color: THEME.textPrimary,
    border: `1px solid ${THEME.border}`,
    borderRadius: '999px',
    padding: '11px 15px',
    fontSize: '14px',
    fontWeight: '900',
    cursor: 'pointer',
    flexShrink: 0,
  },
  templateErrorText: {
    margin: '0 0 12px 0',
    color: THEME.dangerRed,
    fontSize: '13px',
    fontWeight: '800',
  },
  templateEmptyState: {
    background: 'rgba(255, 255, 255, 0.055)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '22px',
    padding: '20px',
    boxShadow: THEME.shadow,
  },
  templateCardList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
    gap: '14px',
  },
  templateCard: {
    background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.095), rgba(255, 255, 255, 0.038))',
    border: `1px solid ${THEME.border}`,
    borderRadius: '24px',
    padding: '18px',
    boxShadow: THEME.shadow,
    backdropFilter: 'blur(16px)',
  },
  templateCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },
  templateCardTitle: {
    margin: 0,
    color: THEME.textPrimary,
    fontSize: '19px',
    fontWeight: '900',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  templateExerciseCount: {
    margin: '6px 0 0 0',
    color: THEME.accentGold,
    fontSize: '13px',
    fontWeight: '800',
  },
  templateNotes: {
    margin: '12px 0 0 0',
    color: THEME.textSecondary,
    fontSize: '14px',
    lineHeight: 1.45,
  },
  templateCardActions: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 1fr',
    gap: '8px',
    marginTop: '18px',
  },
  templateStartBtn: {
    background: 'linear-gradient(135deg, #FF3B30, #DA291C)',
    color: THEME.textPrimary,
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '999px',
    padding: '11px 8px',
    fontSize: '13px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  templateActionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    color: THEME.textSecondary,
    border: `1px solid ${THEME.border}`,
    borderRadius: '999px',
    padding: '10px 8px',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  templateDeleteBtn: {
    backgroundColor: THEME.dangerSoft,
    color: THEME.dangerRed,
    border: `1px solid rgba(255, 69, 58, 0.24)`,
    borderRadius: '999px',
    padding: '10px 8px',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  templateModalBody: {
    padding: '24px clamp(18px, 4vw, 28px) calc(24px + env(safe-area-inset-bottom))',
    overflowY: 'auto',
    flex: 1,
    minHeight: 0,
  },
  templateLibraryPanel: {
    background: 'rgba(255, 255, 255, 0.055)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '22px',
    padding: '16px',
    marginBottom: '18px',
  },
  templateLibraryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  templateSubTitle: {
    margin: 0,
    color: THEME.textPrimary,
    fontSize: '16px',
    fontWeight: '900',
  },
  templateLibraryList: {
    maxHeight: '290px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  templateLibraryGroup: {
    marginBottom: '14px',
  },
  templateLibraryGroupTitle: {
    margin: '0 0 8px 0',
    color: THEME.accentGold,
    fontSize: '12px',
    fontWeight: '900',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  templateLibraryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 0',
    borderBottom: `1px solid ${THEME.border}`,
  },
  templateLibraryName: {
    margin: 0,
    color: THEME.textPrimary,
    fontSize: '14px',
    fontWeight: '800',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  templateLibraryMeta: {
    margin: '3px 0 0 0',
    color: THEME.textSecondary,
    fontSize: '11px',
  },
  templateLibraryAddBtn: {
    backgroundColor: THEME.redSoft,
    color: THEME.primaryRed,
    border: `1px solid ${THEME.redMedium}`,
    borderRadius: '8px',
    padding: '7px 10px',
    fontSize: '12px',
    fontWeight: '900',
    cursor: 'pointer',
    flexShrink: 0,
  },
  templateLibraryEmpty: {
    margin: '8px 0',
    color: THEME.textSecondary,
    textAlign: 'center',
    fontSize: '14px',
  },
  templateExerciseEditorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    gap: '12px',
  },
  templateExerciseEditorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  },
  templateExerciseEditorCard: {
    background: 'rgba(255, 255, 255, 0.055)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '20px',
    padding: '15px',
  },
  templateExerciseEditorTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  templateDragHandle: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    padding: '4px',
    color: THEME.textSecondary,
    cursor: 'grab',
    opacity: 0.5,
    userSelect: 'none',
  },
  templateReorderButtons: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  templateReorderBtn: {
    minHeight: '26px',
    minWidth: '30px',
    padding: '4px 6px',
    color: THEME.textSecondary,
    fontSize: '10px',
    border: `1px solid ${THEME.border}`,
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.04)',
    cursor: 'pointer',
  },
  templateExerciseEditorTitle: {
    margin: 0,
    color: THEME.textPrimary,
    fontSize: '16px',
    fontWeight: '900',
  },
  templateExerciseEditorGroup: {
    margin: '4px 0 0 0',
    color: THEME.accentGold,
    fontSize: '12px',
    fontWeight: '800',
  },
  templateRemoveBtn: {
    backgroundColor: THEME.dangerSoft,
    color: THEME.dangerRed,
    border: `1px solid rgba(255, 69, 58, 0.24)`,
    borderRadius: '999px',
    padding: '8px 10px',
    fontSize: '12px',
    fontWeight: '800',
    cursor: 'pointer',
    flexShrink: 0,
  },
  templateExerciseFields: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
    gap: '10px',
  },
  templateModalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '18px',
    paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
  },

  importTemplateModalBody: {
    padding: '24px clamp(18px, 4vw, 28px) calc(24px + env(safe-area-inset-bottom))',
    overflowY: 'auto',
    flex: 1,
    minHeight: 0,
  },
  importUploadPanel: {
    background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.04))',
    border: `1px solid ${THEME.border}`,
    borderRadius: '24px',
    padding: '18px',
    marginBottom: '18px',
    boxShadow: THEME.shadow,
    backdropFilter: 'blur(16px)',
  },
  importUploadTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  uploadImageButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '44px',
    backgroundColor: 'rgba(255, 255, 255, 0.065)',
    color: THEME.textPrimary,
    border: `1px solid ${THEME.border}`,
    borderRadius: '999px',
    padding: '0 14px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  parseImageBtn: {
    minHeight: '44px',
    background: 'linear-gradient(135deg, #FF3B30, #DA291C)',
    color: THEME.textPrimary,
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '999px',
    padding: '0 14px',
    fontWeight: '900',
    cursor: 'pointer',
  },
  importHint: {
    margin: '12px 0 0 0',
    color: THEME.textSecondary,
    fontSize: '12px',
    lineHeight: 1.45,
  },
  importFileName: {
    margin: '10px 0 0 0',
    color: THEME.accentGold,
    fontSize: '13px',
    fontWeight: '800',
    overflowWrap: 'anywhere',
  },
  importImagePreviewWrap: {
    marginTop: '14px',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '22px',
    overflow: 'hidden',
    maxHeight: '280px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importImagePreview: {
    width: '100%',
    maxHeight: '280px',
    objectFit: 'contain',
    display: 'block',
  },
  importLoadingState: {
    marginTop: '14px',
    padding: '13px',
    backgroundColor: THEME.redSoft,
    color: THEME.primaryRed,
    border: `1px solid ${THEME.redMedium}`,
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '900',
    textAlign: 'center',
  },
  importReviewPanel: {
    backgroundColor: THEME.bgBlack,
    borderTop: `1px solid ${THEME.border}`,
    paddingTop: '4px',
  },
  importEmptyState: {
    backgroundColor: THEME.cardBg,
    border: `1px solid ${THEME.border}`,
    borderRadius: '12px',
    padding: '18px',
    marginBottom: '16px',
  },
  importReviewList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  },
  importReviewCard: {
    background: 'rgba(255, 255, 255, 0.055)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '20px',
    padding: '15px',
    boxShadow: THEME.shadow,
  },
  importReviewCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px',
  },
  importBadges: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },
  importConfidenceBadge: {
    border: `1px solid ${THEME.border}`,
    color: THEME.textSecondary,
    borderRadius: '999px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: '900',
  },
  importNewBadge: {
    border: `1px solid ${THEME.redMedium}`,
    backgroundColor: THEME.redSoft,
    color: THEME.primaryRed,
    borderRadius: '999px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: '900',
  },
  importReviewWarning: {
    margin: '8px 0 0 0',
    color: THEME.accentGold,
    fontSize: '12px',
    fontWeight: '800',
  },
  importReviewFields: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '10px',
  },
  importFieldWide: {
    gridColumn: '1 / -1',
  },

  historyExerciseBlock: { marginTop: '10px', backgroundColor: 'rgba(255, 255, 255, 0.045)', borderRadius: '18px', padding: '14px', border: `1px solid ${THEME.border}` },
  historyExerciseTitle: { margin: '0 0 10px 0', fontSize: '16px', fontWeight: '800', color: THEME.primaryRed },
  historySetRow: { display: 'flex', alignItems: 'center', fontSize: '14px', color: THEME.textSecondary, padding: '6px 0' },
  dottedLine: { flex: 1, borderBottom: `2px dotted ${THEME.border}`, margin: '0 15px', transform: 'translateY(-3px)' },

  exerciseHistoryOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.overlay,
    zIndex: 180,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'clamp(0px, 4vw, 28px)',
    backdropFilter: 'blur(14px)',
  },
  exerciseHistoryModal: {
    width: '100%',
    maxWidth: '720px',
    height: 'min(100%, 900px)',
    background: 'linear-gradient(180deg, rgba(20, 21, 26, 0.98), rgba(7, 7, 9, 0.98))',
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${THEME.border}`,
    borderRadius: '28px',
    boxShadow: THEME.shadow,
    overflow: 'hidden',
  },
  exerciseHistoryModalBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
  },
  exerciseHistoryStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px',
    marginBottom: '24px',
  },
  exerciseHistoryStatCard: {
    background: 'rgba(255, 255, 255, 0.055)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '18px',
    padding: '15px',
  },
  exerciseHistoryStatLabel: {
    display: 'block',
    color: THEME.textSecondary,
    fontSize: '12px',
    fontWeight: '800',
    marginBottom: '7px',
  },
  exerciseHistoryStatValue: {
    display: 'block',
    color: THEME.textPrimary,
    fontSize: '18px',
    fontWeight: '900',
    lineHeight: 1.25,
    overflowWrap: 'anywhere',
  },
  exerciseHistorySectionTitle: {
    margin: '0 0 12px 0',
    color: THEME.textPrimary,
    fontSize: '17px',
    fontWeight: '900',
  },
  exerciseHistorySessionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    paddingBottom: '30px',
  },
  exerciseHistorySessionCard: {
    background: 'rgba(255, 255, 255, 0.055)',
    border: `1px solid ${THEME.border}`,
    borderRadius: '20px',
    padding: '16px',
    boxShadow: THEME.shadow,
  },
  exerciseHistorySessionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    paddingBottom: '12px',
    marginBottom: '8px',
    borderBottom: `1px solid ${THEME.border}`,
  },
  exerciseHistorySessionDate: {
    margin: 0,
    color: THEME.textPrimary,
    fontSize: '16px',
    fontWeight: '900',
  },
  exerciseHistoryExerciseName: {
    margin: '4px 0 0 0',
    color: THEME.primaryRed,
    fontSize: '13px',
    fontWeight: '800',
  },
  exerciseHistoryDuration: {
    color: THEME.accentGold,
    fontSize: '12px',
    fontWeight: '900',
    flexShrink: 0,
  },
  exerciseHistorySetRow: {
    display: 'grid',
    gridTemplateColumns: '66px minmax(0, 1fr)',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 0',
    color: THEME.textSecondary,
    fontSize: '14px',
  },
  exerciseHistorySetLabel: {
    color: THEME.textPrimary,
    fontWeight: '900',
  },
  exerciseHistorySetValue: {
    color: THEME.textSecondary,
    fontWeight: '700',
    overflowWrap: 'anywhere',
  },
  exerciseHistoryCompletedBadge: {
    border: `1px solid ${THEME.border}`,
    borderRadius: '999px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: '900',
    whiteSpace: 'nowrap',
  },
  exerciseHistoryEmptyState: {
    marginTop: '44px',
    backgroundColor: THEME.cardBg,
    border: `1px solid ${THEME.border}`,
    borderRadius: '12px',
    padding: '22px',
    textAlign: 'center',
    boxShadow: THEME.shadow,
  },
  exerciseHistoryEmptyTitle: {
    margin: '0 0 8px 0',
    color: THEME.textPrimary,
    fontSize: '16px',
    fontWeight: '900',
  },
  exerciseHistoryEmptyText: {
    margin: 0,
    color: THEME.textSecondary,
    fontSize: '14px',
    lineHeight: 1.45,
  },

  exerciseBlock: {
    padding: '18px',
    margin: '0 clamp(14px, 4vw, 30px) 18px',
    background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.095), rgba(255, 255, 255, 0.04))',
    border: `1px solid ${THEME.border}`,
    borderRadius: '24px',
    boxShadow: THEME.shadow,
    backdropFilter: 'blur(16px)',
  },
  exerciseHeader: { marginBottom: '15px' },
  exerciseName: { margin: '0', fontSize: '18px', fontWeight: '900', color: THEME.textPrimary },
  tableHeader: { display: 'flex', color: THEME.textSecondary, fontSize: '12px', fontWeight: '900', marginBottom: '10px', textTransform: 'uppercase' },
  setRow: { display: 'flex', alignItems: 'center', marginBottom: '8px', padding: '7px 0', borderRadius: '16px', border: '1px solid transparent', transition: 'background-color 0.26s cubic-bezier(.2,.8,.2,1), border-color 0.26s cubic-bezier(.2,.8,.2,1), transform 0.26s cubic-bezier(.2,.8,.2,1)' },
  setCol: { flex: 0.5, textAlign: 'center', fontWeight: '800', color: THEME.textSecondary },
  prevCol: { flex: 1, textAlign: 'center', color: THEME.textSecondary, fontSize: '14px' },
  inputColTitle: { flex: 1, textAlign: 'center' },
  inputCol: { flex: 1, margin: '0 5px' },
  checkCol: { flex: 0.5, display: 'flex', justifyContent: 'center' },
  inputField: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    color: THEME.textPrimary,
    border: `1px solid ${THEME.border}`,
    borderRadius: '14px',
    padding: '10px 0',
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: '800',
    outline: 'none',
    boxSizing: 'border-box',
  },
  checkButton: { width: '34px', height: '34px', borderRadius: '50%', border: `1px solid ${THEME.border}`, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: '900', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)' },
  addSetText: { color: THEME.accentGold, fontSize: '15px', fontWeight: '800', cursor: 'pointer', padding: '10px' },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(180deg, rgba(20, 21, 26, 0.985), rgba(5, 5, 6, 0.985))',
    zIndex: 320,
    display: 'flex',
    flexDirection: 'column',
    backdropFilter: 'blur(18px)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'calc(12px + env(safe-area-inset-top)) clamp(18px, 4vw, 28px) 16px',
    borderBottom: `1px solid ${THEME.border}`,
    background: 'rgba(255, 255, 255, 0.055)',
    backdropFilter: 'blur(18px)',
  },
  modalClose: { fontSize: '24px', cursor: 'pointer', color: THEME.textSecondary },
  exercisePickerShell: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  exerciseSearchPanel: { padding: '20px clamp(18px, 4vw, 28px)', borderBottom: `1px solid ${THEME.border}`, display: 'flex', alignItems: 'center', gap: '10px' },
  exercisePickerList: { overflowY: 'auto', padding: '4px clamp(18px, 4vw, 28px) 54px', flex: 1 },
  exercisePickerGroup: { padding: '10px 0' },
  exercisePickerGroupTitle: { color: THEME.accentGold, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '10px' },
  exercisePickerPrimary: { display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 },
  exercisePickerName: { margin: 0, fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis' },
  exercisePickerHighlightedRow: { backgroundColor: THEME.goldSoft, borderRadius: '10px', paddingLeft: '8px', paddingRight: '8px' },
  templatePickerShell: { display: 'flex', flexDirection: 'column', minHeight: 0 },
  templatePickerSearchPanel: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  templateExercisePickerList: { maxHeight: '290px', overflowY: 'auto', paddingRight: '4px' },
  templatePickerEmptyState: { padding: '18px', backgroundColor: 'rgba(255, 255, 255, 0.045)', border: `1px solid ${THEME.border}`, borderRadius: '18px', textAlign: 'center' },
  searchResultLabel: { margin: '18px 20px 4px 20px', color: THEME.textSecondary, fontSize: '13px', fontWeight: '800' },
  emptyExerciseState: { margin: '44px 0 0', padding: '24px', background: 'rgba(255, 255, 255, 0.055)', border: `1px solid ${THEME.border}`, borderRadius: '22px', textAlign: 'center', boxShadow: THEME.shadow },
  createExerciseIconBtn: { width: '52px', height: '52px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #FF3B30, #DA291C)', color: THEME.textPrimary, border: '1px solid rgba(255, 255, 255, 0.14)', borderRadius: '18px', fontSize: '28px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 16px 34px rgba(218, 41, 28, 0.28)' },
  emptyCreateExerciseBtn: { width: '48px', height: '48px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.primaryRed, color: THEME.textPrimary, border: `1px solid ${THEME.primaryRed}`, borderRadius: '50%', fontSize: '28px', fontWeight: '900', cursor: 'pointer' },
  exerciseListItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 12px', borderBottom: `1px solid ${THEME.border}`, borderRadius: '16px', cursor: 'pointer', transition: 'background-color 0.26s cubic-bezier(.2,.8,.2,1), transform 0.26s cubic-bezier(.2,.8,.2,1)' },
  exerciseListActions: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  exerciseHistoryBtn: { backgroundColor: 'rgba(255, 255, 255, 0.055)', color: THEME.textSecondary, border: `1px solid ${THEME.border}`, borderRadius: '999px', padding: '6px 10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' },
  addExerciseIconBtn: { width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.redSoft, color: THEME.primaryRed, border: `1px solid ${THEME.redMedium}`, borderRadius: '50%', fontSize: '22px', fontWeight: '800', cursor: 'pointer' },
  createExerciseModalBody: { padding: '24px clamp(18px, 4vw, 28px) calc(24px + env(safe-area-inset-bottom))', overflowY: 'auto', flex: 1, minHeight: 0 },
  textAreaField: { width: '100%', minHeight: '110px', padding: '14px', marginBottom: '15px', backgroundColor: 'rgba(255, 255, 255, 0.065)', color: THEME.textPrimary, border: `1px solid ${THEME.border}`, borderRadius: '16px', fontSize: '16px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' },
  formError: { margin: '0 0 15px 0', color: THEME.dangerRed, fontSize: '13px', fontWeight: '800' },
  createExerciseActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' },
  cancelBtn: { flex: 1, padding: '14px', backgroundColor: 'rgba(255, 255, 255, 0.055)', color: THEME.textSecondary, border: `1px solid ${THEME.border}`, borderRadius: '999px', fontSize: '15px', fontWeight: '800', cursor: 'pointer' },
  saveExerciseBtn: { flex: 1, padding: '14px', background: 'linear-gradient(135deg, #FF3B30, #DA291C)', color: THEME.textPrimary, border: '1px solid rgba(255, 255, 255, 0.14)', borderRadius: '999px', fontSize: '15px', fontWeight: '900', cursor: 'pointer' },
  navArrow: { backgroundColor: 'transparent', color: THEME.primaryRed, border: 'none', fontSize: '14px', fontWeight: '800', cursor: 'pointer', transition: 'opacity 0.2s, color 0.2s' }
};
