import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, setDoc, getDoc } from "firebase/firestore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 2. EXERCISE DATABASE
const EXERCISE_DATABASE = {
  "Chest": ["Bench Press", "Incline Dumbbell Press", "Cable Crossovers", "Dips", "Low Incline Dumbbell Press", "Flat Dumbbell Fly", "Deficit Push-up"],
  "Back": ["Barbell Deadlift", "Pull-ups", "Lat Pulldowns", "Barbell Row", "Lat Prayer", "Deficit Barbell Row"],
  "Shoulders": ["Overhead Press", "Lateral Raises", "Arnold Press", "Face Pulls", "Seated Lateral Raise", "Super ROM Lateral Raise"],
  "Legs": ["Barbell Squat", "High Bar Squat", "Front Squat", "Goblet Squat", "Hack Squat", "Leg Press", "Reverse Nordic", "Sissy Squat", "Leg Extensions", "Bulgarian Split Squat", "Front Foot Elevated Smith Lunge", "Seated Machine Adductor", "Romanian Deadlift (RDL)", "Stiff Legged Deadlift", "Single-Leg RDL", "Good Mornings", "Seated/Lying Leg Curl", "Glute-Ham Raise (GHR)", "Nordic Hamstring Curl", "Glute Thrust Machine", "Barbell Hip Thrust", "Sit Back Squat", "Deficit Reverse Lunge", "Cable Glute Kickbacks", "Weighted Step-Ups", "Seated Machine Abductor", "Calf Raises", "Standing Calf Raise", "Seated Calf Raise", "Tibialis Raise"],
  "Arms": ["Bicep Curls", "Triceps Pushdown", "Skull Crushers", "Hammer Curls", "Overhead Extension", "Dip Machine", "Decline Dumbbell Curl", "Incline Dumbbell Curl", "Superman Cable Curl"],
  "Core": ["Hanging Leg Raises", "Cable Crunches", "Plank"]
};

// 4. SEASONING DATABASE 
const SEASONING_DATABASE = [
  { key: 'soySauce', label: 'Soy Sauce', kcal: 5 },
  { key: 'fishSauce', label: 'Fish Sauce', kcal: 5 },
  { key: 'msg', label: 'MSG / Bouillon', kcal: 0 },
  { key: 'oysterSauce', label: 'Oyster Sauce', kcal: 15 },
  { key: 'sugar', label: 'Added Sugar', kcal: 20 },
  { key: 'sesameOil', label: 'Sesame Oil', kcal: 40 },
  { key: 'chiliOil', label: 'Chili Oil (Sa Tế)', kcal: 45 },
  { key: 'peanutSauce', label: 'Peanut Sauce', kcal: 50 },
  { key: 'coconutMilk', label: 'Coconut Milk', kcal: 50 },
  { key: 'scallionOil', label: 'Scallion Oil (Mỡ hành)', kcal: 60 }
];

export default function App() {
  // --- STATE MANAGEMENT ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [foodSearch, setFoodSearch] = useState('');
  const [foodResults, setFoodResults] = useState([]);
  const [isSearchingFood, setIsSearchingFood] = useState(false);
  // --- TAB PERSISTENCE STATE ---
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('eliteTrackerTab') || 'workout';
  });

  useEffect(() => {
    localStorage.setItem('eliteTrackerTab', activeTab);
  }, [activeTab]);
  // --- FAVORITE EXERCISES STATE ---
  const [favoriteExercises, setFavoriteExercises] = useState(() => {
    const savedFavs = localStorage.getItem('eliteTrackerFavorites');
    return savedFavs ? JSON.parse(savedFavs) : [];
  });

  useEffect(() => {
    localStorage.setItem('eliteTrackerFavorites', JSON.stringify(favoriteExercises));
  }, [favoriteExercises]);
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null); 
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeWorkout, setActiveWorkout] = useState({});
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [seconds, setSeconds] = useState(0);
  
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
  
  // NUTRITION MODAL STATES 
  const [selectedFood, setSelectedFood] = useState(null);
  const [foodWeight, setFoodWeight] = useState(100);
  const [cookingMethod, setCookingMethod] = useState('raw_boiled');
  const [activeSeasonings, setActiveSeasonings] = useState({});

  const [customExercise, setCustomExercise] = useState('');
  const [prevData, setPrevData] = useState({}); 

  // --- USE EFFECTS ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const logsQuery = query(collection(db, "users", user.uid, "daily_logs"), orderBy("timestamp", "desc"));
      const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
        const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDailyLogs(logsData);
        if (logsData.length >= 7) {
          calculateDynamicTDEE(logsData);
        } else {
          setDynamicTDEE(null);
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const historyQuery = query(collection(db, "users", user.uid, "history"), orderBy("timestamp", "desc"));
      const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
        const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setWorkoutHistory(historyData);
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    let interval = null;
    if (isWorkoutActive) {
      interval = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isWorkoutActive]);

  useEffect(() => {
    if (isWorkoutActive && workoutHistory.length > 0) {
      const activeExercises = Object.keys(activeWorkout);
      let newPrevData = {};
      activeExercises.forEach(exName => {
        const lastWorkoutWithEx = workoutHistory.find(h => h.data && h.data[exName]);
        if (lastWorkoutWithEx) {
          const lastSets = lastWorkoutWithEx.data[exName];
          const bestSet = lastSets.reduce((prev, current) => (parseFloat(prev.weight) > parseFloat(current.weight)) ? prev : current);
          newPrevData[exName] = `${bestSet.weight}kg x ${bestSet.reps}`;
        }
      });
      setPrevData(newPrevData);
    }
  }, [activeWorkout, isWorkoutActive, workoutHistory]);

  // --- HELPER FUNCTIONS ---
  const getTodayDocId = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const toggleFavorite = (e, exerciseName) => {
    e.stopPropagation();
    setFavoriteExercises(prev => {
      if (prev.includes(exerciseName)) {
        return prev.filter(ex => ex !== exerciseName);
      }
      return [...prev, exerciseName];
    });
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

  const generateTrendData = () => {
    if (dailyLogs.length === 0) return [];

    const chronologicalLogs = [...dailyLogs].reverse();
    const alpha = 2 / (7 + 1); 
    
    let currentEMA = chronologicalLogs[0].weight; 

    return chronologicalLogs.map((log) => {
      const actualWeight = parseFloat(log.weight || currentEMA);
      currentEMA = (alpha * actualWeight) + ((1 - alpha) * currentEMA);
      const shortDate = new Date(log.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
      
      return {
        date: shortDate,
        Actual: actualWeight,
        Trend: parseFloat(currentEMA.toFixed(2))
      };
    });
  };

  const deleteDailyLog = async (logId) => {
    try {
      await deleteDoc(doc(db, "users", user.uid, "daily_logs", logId));
      alert("Nutrition log deleted successfully!");
    } catch (error) { 
      alert("Failed to delete log: " + error.message); 
    }
  };

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

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentWeek = () => {
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
  };

  // Function to search generic foods via USDA FoodData Central API (Upgraded Nutrient Parsing)
  const searchFood = async () => {
    if (!foodSearch.trim()) return;
    setIsSearchingFood(true);
    try {
      const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=PAZkSKwUUNLnxrIKC82rU0fCF24iGu2Qa1jsoLIe&query=${encodeURIComponent(foodSearch)}&dataType=Foundation,SR%20Legacy&pageSize=10`);
      const data = await response.json();

      if (!data.foods) {
        setFoodResults([]);
        setIsSearchingFood(false);
        return;
      }

      const formattedResults = data.foods.map(p => {
        // CẬP NHẬT: Quét chéo cả ID mới lẫn Number cũ để không sót Macros
        const getNutrient = (id, num) => {
          const nutrient = p.foodNutrients.find(n => n.nutrientId === id || n.nutrientNumber === num);
          return nutrient ? Math.round(nutrient.value) : 0;
        };
        
        const cleanName = p.description.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

        return {
          id: p.fdcId,
          name: cleanName,
          brand: "(Generic/Raw Food)",
          kcal: getNutrient(1008, '208'), // Energy
          protein: getNutrient(1003, '203'), // Protein
          fat: getNutrient(1004, '204'), // Total Lipid (Fat)
          carbs: getNutrient(1005, '205') // Carbohydrate
        };
      }).filter(food => food.kcal > 0); 

      setFoodResults(formattedResults);
    } catch (error) {
      alert("Error fetching food database: " + error.message);
    }
    setIsSearchingFood(false);
  };

  const openFoodModal = (food) => {
    setSelectedFood(food);
    setFoodWeight(100);
    setCookingMethod('raw_boiled');
    
    const initialSeasonings = {};
    SEASONING_DATABASE.forEach(s => { initialSeasonings[s.key] = false; });
    setActiveSeasonings(initialSeasonings);
  };

  const confirmAndLogFood = async () => {
    if (!selectedFood) return;

    const cookingModifiers = { raw_boiled: 0, grilled: 20, stir_fried: 50, deep_fried: 100 };
    let totalSeasoningKcal = 0;
    SEASONING_DATABASE.forEach(seasoning => {
      if (activeSeasonings[seasoning.key]) totalSeasoningKcal += seasoning.kcal;
    });

    const weightRatio = parseFloat(foodWeight) / 100;
    
    const baseKcal = selectedFood.kcal;
    const extraKcal = cookingModifiers[cookingMethod] + totalSeasoningKcal;
    const finalCalculatedKcal = Math.round((baseKcal + extraKcal) * weightRatio);

    const calculatedProtein = Math.round((selectedFood.protein || 0) * weightRatio);
    const calculatedCarbs = Math.round((selectedFood.carbs || 0) * weightRatio);
    const calculatedFat = Math.round((selectedFood.fat || 0) * weightRatio);

    const todayId = getTodayDocId();
    const logRef = doc(db, "users", user.uid, "daily_logs", todayId);

    try {
      const docSnap = await getDoc(logRef);
      let currentFoods = [];
      let currentCalories = 0;
      let currentWeight = ''; 
      
      let currentProtein = 0;
      let currentCarbs = 0;
      let currentFat = 0;

      if (docSnap.exists()) {
        const data = docSnap.data();
        currentFoods = data.foods || [];
        currentCalories = data.calories || 0;
        currentWeight = data.weight || '';
        currentProtein = data.protein || 0;
        currentCarbs = data.carbs || 0;
        currentFat = data.fat || 0;
      }

      const existingFoodIndex = currentFoods.findIndex(f => f.name === selectedFood.name);
      
      if (existingFoodIndex >= 0) {
        currentFoods[existingFoodIndex].weight += parseFloat(foodWeight);
        currentFoods[existingFoodIndex].kcal += finalCalculatedKcal;
        currentFoods[existingFoodIndex].protein = (currentFoods[existingFoodIndex].protein || 0) + calculatedProtein;
        currentFoods[existingFoodIndex].carbs = (currentFoods[existingFoodIndex].carbs || 0) + calculatedCarbs;
        currentFoods[existingFoodIndex].fat = (currentFoods[existingFoodIndex].fat || 0) + calculatedFat;
        currentFoods[existingFoodIndex].time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      } else {
        currentFoods.push({
          name: selectedFood.name,
          weight: parseFloat(foodWeight),
          kcal: finalCalculatedKcal,
          protein: calculatedProtein,
          carbs: calculatedCarbs,
          fat: calculatedFat,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        });
      }

      await setDoc(logRef, {
        timestamp: docSnap.exists() ? docSnap.data().timestamp : Date.now(),
        date: new Date().toLocaleDateString('en-US'),
        foods: currentFoods,
        calories: currentCalories + finalCalculatedKcal,
        protein: currentProtein + calculatedProtein,
        carbs: currentCarbs + calculatedCarbs,
        fat: currentFat + calculatedFat,
        weight: currentWeight
      }, { merge: true });

      alert(`Added ${foodWeight}g of ${selectedFood.name}. Macros updated!`);
      setSelectedFood(null);
      setFoodSearch('');
      setFoodResults([]);
    } catch (e) {
      alert("Database Error: " + e.message);
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
  const startWorkout = () => { setIsWorkoutActive(true); setSeconds(0); setActiveWorkout({}); };

  const discardWorkout = () => {
    if(window.confirm("Are you sure you want to discard this session? All progress will be lost.")) {
      setIsWorkoutActive(false); setActiveWorkout({}); setSeconds(0);
    }
  };

  const addExerciseToWorkout = (exerciseName) => {
    if (!activeWorkout[exerciseName]) {
      setActiveWorkout(prev => ({ ...prev, [exerciseName]: [{ reps: '', weight: '', completed: false }] }));
    }
    setShowExerciseModal(false);
  };

  const updateSet = (exercise, setIndex, field, value) => {
    const updated = { ...activeWorkout };
    updated[exercise][setIndex][field] = value;
    setActiveWorkout(updated);
  };

  const addSet = (exercise) => {
    const updated = { ...activeWorkout };
    const currentSets = updated[exercise];
    
    let inheritedWeight = '';
    let inheritedReps = '';
    
    if (currentSets.length > 0) {
      const lastSet = currentSets[currentSets.length - 1];
      inheritedWeight = lastSet.weight;
      inheritedReps = lastSet.reps;
    }

    currentSets.push({ reps: inheritedReps, weight: inheritedWeight, completed: false });
    setActiveWorkout(updated);
  };

  const toggleSetCompletion = (exercise, setIndex) => {
    const updated = { ...activeWorkout };
    updated[exercise][setIndex].completed = !updated[exercise][setIndex].completed;
    setActiveWorkout(updated);
  };

  const finishWorkout = async () => {
    if (Object.keys(activeWorkout).length === 0) return alert("Log data to proceed.");
    try {
      await addDoc(collection(db, "users", user.uid, "history"), {
        timestamp: Date.now(),
        date: new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        matchDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
        duration: formatTime(seconds),
        data: activeWorkout
      });
      setIsWorkoutActive(false); setActiveWorkout({}); setActiveTab('history'); setSelectedDate(null);
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
    const sanitizedEmail = email.trim();
    if (!sanitizedEmail) return alert("Please enter an email address.");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) return alert("Please enter a formally valid email format.");
    if (!password || password.length < 6) return alert("Password must be at least 6 characters.");

    try {
      if (type === 'signup') await createUserWithEmailAndPassword(auth, sanitizedEmail, password);
      else await signInWithEmailAndPassword(auth, sanitizedEmail, password);
    } catch (e) { alert("Firebase Protocol: " + e.message); }
  };

  // --- RENDER FLOW ---
  if (authLoading) return <div style={styles.appContainer}><p style={{padding: '50px'}}>Loading...</p></div>;

  if (!user) {
    return (
      <div style={{...styles.appContainer, justifyContent: 'center', alignItems: 'center', padding: '40px'}}>
        <h1 style={{color: '#0A84FF', fontSize: '32px', marginBottom: '40px'}}>Elite Tracker</h1>
        <input type="email" placeholder="Email" style={styles.authInput} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" style={styles.authInput} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={() => handleAuth('login')} style={styles.authButton}>Login</button>
        <button onClick={() => handleAuth('signup')} style={{...styles.authButton, backgroundColor: '#1C1C1E', marginTop: '10px'}}>Sign Up</button>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {/* GLOBAL HEADER & MENU BUTTON */}
      {!isWorkoutActive && (
        <header style={styles.globalHeader}>
          <h1 style={{margin: 0, fontSize: '20px', color: '#0A84FF', fontWeight: 'bold'}}>Elite Tracker</h1>
          <button onClick={() => setIsMenuOpen(true)} style={styles.menuButton}>☰</button>
        </header>
      )}

      <div style={styles.contentScroll}>
        
        {/* WORKOUT TAB */}
        {activeTab === 'workout' && (
          <div>
            {!isWorkoutActive ? (
              <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '50px 20px'}}>
                <h2 style={{fontSize: '24px', marginBottom: '20px'}}>Ready to train?</h2>
                <button onClick={startWorkout} style={styles.mainBtn}>Start an Empty Workout</button>
              </div>
            ) : (
              <div>
                <div style={styles.topBar}>
                  <span style={{color: '#8E8E93', fontSize: '20px', cursor: 'pointer'}} onClick={discardWorkout}>▼</span>
                  <span style={{color: '#0A84FF', fontWeight: 'bold', cursor: 'pointer', fontSize: '18px'}} onClick={finishWorkout}>Finish</span>
                </div>
                <h1 style={styles.timerText}>{formatTime(seconds)}</h1>

                {Object.keys(activeWorkout).length === 0 ? (
                  <p style={{textAlign: 'center', color: '#8E8E93', marginTop: '40px'}}>Tap below to add your first exercise.</p>
                ) : (
                  Object.entries(activeWorkout).map(([exercise, sets]) => (
                    <div key={exercise} style={styles.exerciseBlock}>
                      <div style={styles.exerciseHeader}><h3 style={styles.exerciseName}>{exercise}</h3></div>
                      <div style={styles.tableHeader}>
                        <span style={styles.setCol}>Set</span>
                        <span style={styles.prevCol}>Prev</span>
                        <span style={styles.inputColTitle}>kg</span>
                        <span style={styles.inputColTitle}>Reps</span>
                        <span style={styles.checkCol}>✓</span>
                      </div>
                      {sets.map((set, idx) => (
                        <div key={idx} style={{...styles.setRow, backgroundColor: set.completed ? 'rgba(52, 199, 89, 0.15)' : 'transparent'}}>
                          <span style={styles.setCol}>{idx + 1}</span>
                          <span style={styles.prevCol}>{prevData[exercise] || "—"}</span>
                          <div style={styles.inputCol}>
                          <input 
                            type="number" 
                            step="0.1" 
                            placeholder="0" 
                            value={set.weight} 
                            onChange={(e) => updateSet(exercise, idx, 'weight', e.target.value)} 
                            style={styles.inputField} 
                            />
                          </div>
                          <div style={styles.inputCol}><input type="number" placeholder="0" value={set.reps} onChange={(e) => updateSet(exercise, idx, 'reps', e.target.value)} style={styles.inputField} /></div>
                          <div style={styles.checkCol}><button onClick={() => toggleSetCompletion(exercise, idx)} style={{...styles.checkButton, backgroundColor: set.completed ? '#34C759' : '#2C2C2E', color: set.completed ? '#FFFFFF' : '#8E8E93'}}>✓</button></div>
                        </div>
                      ))}
                      <div style={{textAlign: 'center', marginTop: '10px'}}><span onClick={() => addSet(exercise)} style={styles.addSetText}>+ Add Set</span></div>
                    </div>
                  ))
                )}
                
                <div style={{padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px'}}>
                  <button onClick={() => setShowExerciseModal(true)} style={styles.mainBtn}>+ Add Exercises</button>
                  <button onClick={discardWorkout} style={styles.discardBtn}>Discard Workout</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div style={{padding: '20px'}}>
            <h1 style={{fontSize: '28px', marginBottom: '20px'}}>Your Progress</h1>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <button onClick={() => { setWeekOffset(w => w - 1); setSelectedDate(null); }} style={styles.navArrow}>◀ Past</button>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {weekOffset === 0 ? "Current Week" : `${Math.abs(weekOffset)} Week(s) Ago`}
              </span>
              <button onClick={() => { setWeekOffset(w => w + 1); setSelectedDate(null); }} disabled={weekOffset === 0} style={{ ...styles.navArrow, opacity: weekOffset === 0 ? 0.2 : 1 }}>Future ▶</button>
            </div>
            
            <div style={styles.calendarContainer}>
              {getCurrentWeek().map(dayInfo => {
                const isWorkoutDay = workoutHistory.some(entry => entry.date.includes(dayInfo.matchString));
                const isSelected = selectedDate === dayInfo.matchString;
                return (
                  <div key={dayInfo.date} onClick={() => setSelectedDate(isSelected ? null : dayInfo.matchString)} style={{
                    ...styles.calendarDay, 
                    backgroundColor: isSelected ? '#0A84FF' : (isWorkoutDay ? '#34C759' : '#1C1C1E'),
                    border: dayInfo.isToday ? '1px solid #0A84FF' : '1px solid transparent',
                    cursor: 'pointer', transform: isSelected ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.2s ease'
                  }}>
                    <span style={{fontSize: '10px', color: (isSelected || isWorkoutDay) ? '#000' : '#8E8E93', fontWeight: 'bold'}}>{dayInfo.dayName}</span>
                    <span style={{fontSize: '16px', color: (isSelected || isWorkoutDay) ? '#000' : '#FFF', fontWeight: 'bold'}}>{dayInfo.date}</span>
                  </div>
                );
              })}
            </div>

            {selectedDate && (
              <p style={{color: '#0A84FF', textAlign: 'center', marginBottom: '15px', cursor: 'pointer'}} onClick={() => setSelectedDate(null)}>
                Showing workouts for {selectedDate} (Tap to show all)
              </p>
            )}

            {workoutHistory.filter(entry => !selectedDate || entry.date.includes(selectedDate)).length === 0 ? (
              <p style={{color: '#8E8E93', textAlign: 'center', marginTop: '40px'}}>
                {selectedDate ? `No workouts recorded on ${selectedDate}` : "No history available."}
              </p>
            ) : (
              workoutHistory.filter(entry => !selectedDate || entry.date.includes(selectedDate)).map(entry => (
                <div key={entry.id} style={styles.historyCard}>
                  <div style={styles.historyHeader}>
                    <div>
                      <p style={{margin: 0, fontWeight: 'bold', fontSize: '18px'}}>{entry.date}</p>
                      <p style={{margin: '5px 0 0 0', color: '#0A84FF', fontWeight: 'bold', fontSize: '14px'}}>⏱ {entry.duration}</p>
                    </div>
                    <button onClick={() => deleteHistoryEntry(entry.id)} style={styles.deleteBtn}>Delete</button>
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
        {activeTab === 'tdee' && (
          <div style={{padding: '20px'}}>
            <h2 style={{fontSize: '24px', marginBottom: '20px', textAlign: 'center'}}>Metabolism Engine</h2>
            
            <div style={{backgroundColor: '#1C1C1E', padding: '20px', borderRadius: '12px', marginBottom: '30px', textAlign: 'center'}}>
              <p style={{color: '#8E8E93', margin: '0 0 10px 0'}}>Actual TDEE (Dynamic):</p>
              <p style={{fontSize: '36px', fontWeight: 'bold', color: '#0A84FF', margin: 0}}>
                {dynamicTDEE ? `${dynamicTDEE} kcal` : "Collecting data..."}
              </p>
              {!dynamicTDEE && <p style={{fontSize: '12px', color: '#8E8E93', marginTop: '10px'}}>A minimum of 7 days logged is required for accurate algorithm calibration.</p>}
            </div>

            {dailyLogs.length >= 2 && (
              <div style={{backgroundColor: '#1C1C1E', padding: '20px', borderRadius: '12px', marginBottom: '30px'}}>
                <h3 style={{margin: '0 0 15px 0', fontSize: '18px', color: '#FFF'}}>Weight Trend Analysis</h3>
                <div style={{height: '250px', width: '100%'}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={generateTrendData()} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2C2C2E" vertical={false} />
                      <XAxis dataKey="date" stroke="#8E8E93" fontSize={12} tickLine={false} />
                      <YAxis stroke="#8E8E93" fontSize={12} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                      <Tooltip contentStyle={{backgroundColor: '#0A0A0A', border: '1px solid #2C2C2E', borderRadius: '8px', color: '#FFF'}} itemStyle={{color: '#FFF'}} />
                      <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                      <Line type="monotone" dataKey="Actual" stroke="#8E8E93" strokeWidth={2} strokeDasharray="5 5" dot={{r: 3, fill: '#8E8E93'}} name="Scale Weight" />
                      <Line type="monotone" dataKey="Trend" stroke="#0A84FF" strokeWidth={3} dot={false} activeDot={{r: 6}} name="True Trend (EMA)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p style={{fontSize: '11px', color: '#8E8E93', textAlign: 'center', marginTop: '10px'}}>The blue line represents your true weight trend, filtering out water retention and noise.</p>
              </div>
            )}

            <h3 style={{fontSize: '18px', marginBottom: '15px', textAlign: 'left', color: '#FFF'}}>Daily Check-in</h3>
            <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
              <input 
                type="number" 
                placeholder="Today's Body Weight (kg)" 
                value={dailyWeight} 
                onChange={(e) => setDailyWeight(e.target.value)} 
                style={{...styles.authInput, marginBottom: 0, flex: 1}} 
              />
              <button onClick={updateDailyWeight} style={{...styles.mainBtn, width: '100px', borderRadius: '8px'}}>Update</button>
            </div>

            <h3 style={{fontSize: '20px', marginTop: '40px', marginBottom: '20px'}}>Intake History</h3>
            {dailyLogs.length === 0 ? (
              <p style={{color: '#8E8E93', textAlign: 'center'}}>No history available.</p>
            ) : (
              dailyLogs.map(log => (
                <div key={log.id} style={styles.historyCard}>
                  <div style={{...styles.historyHeader, borderBottom: log.foods && log.foods.length > 0 ? '1px solid #2C2C2E' : 'none'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%'}}>
                      <div>
                        <p style={{margin: 0, fontWeight: 'bold', fontSize: '18px'}}>{log.date}</p>
                        <p style={{margin: '5px 0 0 0', color: '#34C759', fontWeight: 'bold', fontSize: '16px'}}>{log.calories || 0} kcal</p>
                        <p style={{margin: '5px 0 0 0', fontSize: '13px', color: '#8E8E93'}}>
                          <span style={{color: '#FF453A'}}>P: {log.protein || 0}g</span> | <span style={{color: '#32ADE6'}}>C: {log.carbs || 0}g</span> | <span style={{color: '#FFD60A'}}>F: {log.fat || 0}g</span>
                        </p>
                        <p style={{margin: '5px 0 0 0', color: '#8E8E93', fontSize: '14px'}}>Body Weight: {log.weight || 'Not logged'} {log.weight ? 'kg' : ''}</p>
                      </div>
                      <button onClick={() => deleteDailyLog(log.id)} style={styles.deleteBtn}>Delete</button>
                    </div>
                  </div>
                  {log.foods && log.foods.length > 0 && (
                    <div style={{marginTop: '10px'}}>
                      {log.foods.map((food, idx) => (
                        <div key={idx} style={styles.historySetRow}>
                          <span style={{fontWeight: 'bold', color: '#8E8E93', fontSize: '12px', width: '55px'}}>{food.time}</span>
                          <div style={styles.dottedLine}></div>
                          <div style={{textAlign: 'right'}}>
                            <span style={{color: '#FFF', fontSize: '14px', display: 'block'}}>{food.name} ({food.weight}g)</span>
                            <span style={{color: '#34C759', fontSize: '13px', fontWeight: 'bold'}}>{food.kcal} kcal</span>
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

        {/* NUTRITION SEARCH TAB */}
        {activeTab === 'food' && (
          <div style={{padding: '20px'}}>
            <h2 style={{fontSize: '24px', marginBottom: '20px', textAlign: 'center'}}>Nutrition Search</h2>
            
            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <input 
                type="text" 
                placeholder="Search food (e.g., rice, chicken)..." 
                value={foodSearch} 
                onChange={(e) => setFoodSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchFood()}
                style={{...styles.authInput, marginBottom: 0, flex: 1}} 
              />
              <button onClick={searchFood} style={{...styles.mainBtn, width: '80px', borderRadius: '8px'}}>
                {isSearchingFood ? "..." : "Search"}
              </button>
            </div>

            {foodResults.length > 0 ? (
              <div style={{backgroundColor: '#0A0A0A', borderRadius: '12px', padding: '10px', maxHeight: '60vh', overflowY: 'auto'}}>
                {foodResults.map((food) => (
                  <div key={food.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #1C1C1E'}}>
                    <div style={{textAlign: 'left', flex: 1}}>
                      <p style={{margin: '0 0 5px 0', fontSize: '15px', fontWeight: 'bold'}}>{food.name} <span style={{fontSize: '12px', color: '#8E8E93', fontWeight: 'normal'}}>{food.brand}</span></p>
                      <p style={{margin: 0, fontSize: '12px', color: '#8E8E93'}}>
                        <span style={{color: '#FF453A'}}>P: {food.protein}g</span> | <span style={{color: '#32ADE6'}}>C: {food.carbs}g</span> | <span style={{color: '#FFD60A'}}>F: {food.fat}g</span> 
                      </p>
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '10px'}}>
                      <span style={{color: '#34C759', fontWeight: 'bold', fontSize: '16px', marginBottom: '5px'}}>{food.kcal} kcal</span>
                      <button onClick={() => openFoodModal(food)} style={{backgroundColor: '#1C1C1E', color: '#0A84FF', border: 'none', borderRadius: '6px', padding: '5px 10px', fontWeight: 'bold', cursor: 'pointer'}}>Customize</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{textAlign: 'center', color: '#8E8E93', marginTop: '40px'}}>Search for an item to see its nutritional value per 100g.</p>
            )}
          </div>
        )}

        {/* PROFILE / COACHING TAB */}
        {activeTab === 'you' && (
          <div style={{padding: '20px', textAlign: 'center'}}>
            <h2 style={{fontSize: '24px', marginBottom: '20px', textAlign: 'center'}}>AI Coaching Setup</h2>
            <div style={{backgroundColor: '#1C1C1E', padding: '20px', borderRadius: '12px', marginBottom: '30px', textAlign: 'left'}}>
              
              <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                <div style={{flex: 1}}>
                  <label style={{fontSize: '12px', color: '#8E8E93'}}>Age</label>
                  <input type="number" value={profileAge} onChange={(e) => setProfileAge(e.target.value)} style={{...styles.authInput, padding: '10px'}} />
                </div>
                <div style={{flex: 1}}>
                  <label style={{fontSize: '12px', color: '#8E8E93'}}>Height (cm)</label>
                  <input type="number" value={profileHeight} onChange={(e) => setProfileHeight(e.target.value)} style={{...styles.authInput, padding: '10px'}} />
                </div>
                <div style={{flex: 1}}>
                  <label style={{fontSize: '12px', color: '#8E8E93'}}>Weight (kg)</label>
                  <input type="number" value={profileWeight} onChange={(e) => setProfileWeight(e.target.value)} style={{...styles.authInput, padding: '10px'}} />
                </div>
              </div>

              <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                <select value={profileGender} onChange={(e) => setProfileGender(e.target.value)} style={{...styles.authInput, appearance: 'none', padding: '10px', flex: 1}}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <select value={profileActivity} onChange={(e) => setProfileActivity(e.target.value)} style={{...styles.authInput, appearance: 'none', padding: '10px', flex: 1}}>
                  <option value={1.2}>Sedentary</option>
                  <option value={1.375}>Light Active</option>
                  <option value={1.55}>Moderately Active</option>
                  <option value={1.725}>Very Active</option>
                </select>
              </div>

              <select value={profileGoal} onChange={(e) => setProfileGoal(e.target.value)} style={{...styles.authInput, appearance: 'none', padding: '10px', marginBottom: '15px'}}>
                <option value="cut">Fat Loss (-500 kcal)</option>
                <option value="maintain">Maintenance</option>
                <option value="bulk">Muscle Gain (+300 kcal)</option>
              </select>

              <button onClick={calculateCoachingMacros} style={{...styles.mainBtn, backgroundColor: '#0A84FF', color: '#FFF'}}>Generate Plan</button>

              {targetMacros && (
                <div style={{marginTop: '20px', padding: '15px', backgroundColor: '#0A0A0A', borderRadius: '8px', border: '1px solid #34C759'}}>
                  <p style={{textAlign: 'center', color: '#34C759', fontWeight: 'bold', fontSize: '18px', margin: '0 0 10px 0'}}>Target: {targetMacros.kcal} kcal</p>
                  <div style={{display: 'flex', justifyContent: 'space-between', textAlign: 'center'}}>
                    <div>
                      <span style={{color: '#FF453A', display: 'block', fontWeight: 'bold'}}>{targetMacros.protein}g</span>
                      <span style={{color: '#8E8E93', fontSize: '12px'}}>Protein</span>
                    </div>
                    <div>
                      <span style={{color: '#32ADE6', display: 'block', fontWeight: 'bold'}}>{targetMacros.carbs}g</span>
                      <span style={{color: '#8E8E93', fontSize: '12px'}}>Carbs</span>
                    </div>
                    <div>
                      <span style={{color: '#FFD60A', display: 'block', fontWeight: 'bold'}}>{targetMacros.fat}g</span>
                      <span style={{color: '#8E8E93', fontSize: '12px'}}>Fat</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <h2 style={{fontSize: '24px', marginBottom: '40px'}}>Account Details</h2>
            <div style={{backgroundColor: '#1C1C1E', padding: '20px', borderRadius: '12px', marginBottom: '20px'}}>
              <p style={{color: '#8E8E93', margin: '0 0 10px 0'}}>Logged in as:</p>
              <p style={{fontSize: '18px', fontWeight: 'bold', margin: 0}}>{user.email}</p>
            </div>
            <button onClick={() => signOut(auth)} style={{...styles.authButton, backgroundColor: '#FF453A'}}>Sign Out</button>
          </div>
        )}
      </div> 

      {/* EXERCISE MODAL */}
      {showExerciseModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalHeader}>
            <span onClick={() => setShowExerciseModal(false)} style={{fontSize: '24px', cursor: 'pointer', color: '#8E8E93'}}>✕</span>
            <h2 style={{margin: 0, fontSize: '18px'}}>Add Exercises</h2>
            <span style={{width: '24px'}}></span>
          </div>
          
          <div style={{padding: '20px', borderBottom: '1px solid #1C1C1E', display: 'flex', gap: '10px'}}>
            <input 
              style={{...styles.authInput, marginBottom: 0, flex: 1}} 
              placeholder="New exercise name..."
              value={customExercise}
              onChange={(e) => setCustomExercise(e.target.value)}
            />
            <button 
              onClick={() => {
                if(customExercise.trim()) {
                  addExerciseToWorkout(customExercise.trim());
                  setCustomExercise('');
                }
              }}
              style={{...styles.mainBtn, width: '80px', borderRadius: '8px'}}
            >Add</button>
          </div>

          <div style={{overflowY: 'auto', paddingBottom: '50px'}}>
            {Object.entries(EXERCISE_DATABASE).map(([category, exercises]) => {
              
              // Sort exercises: Favorites first
              const sortedExercises = [...exercises].sort((a, b) => {
                const aFav = favoriteExercises.includes(a);
                const bFav = favoriteExercises.includes(b);
                if (aFav && !bFav) return -1;
                if (!aFav && bFav) return 1;
                return 0;
              });

              return (
                <div key={category} style={{padding: '10px 20px'}}>
                  <h3 style={{color: '#0A84FF', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '10px'}}>{category}</h3>
                  {sortedExercises.map(ex => {
                    const isFav = favoriteExercises.includes(ex);
                    return (
                      <div key={ex} onClick={() => addExerciseToWorkout(ex)} style={styles.exerciseListItem}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                          <span 
                            onClick={(e) => toggleFavorite(e, ex)} 
                            style={{
                              fontSize: '22px', 
                              cursor: 'pointer', 
                              color: isFav ? '#FFD60A' : '#2C2C2E',
                              transition: 'color 0.2s'
                            }}
                          >
                            {isFav ? '★' : '☆'}
                          </span>
                          <span style={{fontSize: '16px', color: isFav ? '#FFFFFF' : '#8E8E93', fontWeight: isFav ? 'bold' : 'normal'}}>
                            {ex}
                          </span>
                        </div>
                        <span style={{color: '#0A84FF', fontSize: '24px', fontWeight: '300'}}>+</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SLIDE-IN MENU OVERLAY */}
      {isMenuOpen && (
        <div style={styles.menuOverlay} onClick={() => setIsMenuOpen(false)}>
          <div style={styles.menuContent} onClick={(e) => e.stopPropagation()}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px'}}>
              <h2 style={{margin: 0, color: '#8E8E93', fontSize: '14px', letterSpacing: '2px'}}>NAVIGATION</h2>
              <span onClick={() => setIsMenuOpen(false)} style={styles.closeMenuBtn}>✕</span>
            </div>
            
            {['Workout', 'History', 'TDEE', 'Food', 'You'].map(tab => (
              <button 
                key={tab} 
                onClick={() => { setActiveTab(tab.toLowerCase()); setIsMenuOpen(false); }} 
                style={{
                  ...styles.menuItem, 
                  color: activeTab === tab.toLowerCase() ? '#0A84FF' : '#FFFFFF',
                  borderLeft: activeTab === tab.toLowerCase() ? '4px solid #0A84FF' : '4px solid transparent',
                  paddingLeft: activeTab === tab.toLowerCase() ? '16px' : '20px'
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FOOD CUSTOMIZATION MODAL */}
      {selectedFood && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalHeader}>
            <span onClick={() => setSelectedFood(null)} style={{fontSize: '24px', cursor: 'pointer', color: '#8E8E93'}}>✕</span>
            <h2 style={{margin: 0, fontSize: '18px'}}>Log Food</h2>
            <span style={{width: '24px'}}></span>
          </div>

          <div style={{padding: '20px', overflowY: 'auto'}}>
            <h3 style={{fontSize: '20px', color: '#0A84FF', marginBottom: '5px'}}>{selectedFood.name}</h3>
            <p style={{color: '#8E8E93', fontSize: '14px', marginBottom: '20px'}}>Base: {selectedFood.kcal} kcal / 100g</p>

            <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>Weight (grams):</label>
            <input 
              type="number" 
              value={foodWeight}
              onChange={(e) => setFoodWeight(e.target.value)}
              style={styles.authInput} 
            />

            <label style={{display: 'block', margin: '15px 0 8px 0', fontWeight: 'bold'}}>Cooking Method:</label>
            <select 
              value={cookingMethod} 
              onChange={(e) => setCookingMethod(e.target.value)}
              style={{...styles.authInput, appearance: 'none'}}
            >
              <option value="raw_boiled">Raw / Boiled / Steamed (+0 kcal)</option>
              <option value="grilled">Grilled / Roasted (+20 kcal)</option>
              <option value="stir_fried">Stir-Fried / Pan-Fried (+50 kcal)</option>
              <option value="deep_fried">Deep-Fried (+100 kcal)</option>
            </select>

            <label style={{display: 'block', margin: '20px 0 10px 0', fontWeight: 'bold'}}>Condiments & Seasonings (per 100g):</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#1C1C1E', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              {SEASONING_DATABASE.map(seasoning => (
                <div key={seasoning.key} style={{display: 'flex', alignItems: 'flex-start'}}>
                  <input 
                    type="checkbox" 
                    id={`condiment_${seasoning.key}`}
                    checked={activeSeasonings[seasoning.key] || false}
                    onChange={(e) => setActiveSeasonings(prev => ({...prev, [seasoning.key]: e.target.checked}))}
                    style={{width: '18px', height: '18px', marginRight: '8px', accentColor: '#0A84FF', flexShrink: 0, marginTop: '2px'}}
                  />
                  <label htmlFor={`condiment_${seasoning.key}`} style={{fontSize: '13px', cursor: 'pointer', lineHeight: '1.4'}}>
                    <span style={{color: '#FFF', display: 'block'}}>{seasoning.label}</span>
                    <span style={{color: '#8E8E93', fontSize: '11px'}}>{seasoning.kcal > 0 ? `+${seasoning.kcal} kcal` : '0 kcal'}</span>
                  </label>
                </div>
              ))}
            </div>

            <button onClick={confirmAndLogFood} style={{...styles.mainBtn, marginTop: '10px'}}>
              Confirm & Log
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 3. DESIGN SYSTEM 
const styles = {
  appContainer: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#000000', color: '#FFFFFF', fontFamily: '-apple-system, sans-serif' },
  contentScroll: { flex: 1, overflowY: 'auto', paddingBottom: '20px' }, 
  authInput: { width: '100%', padding: '15px', marginBottom: '15px', backgroundColor: '#1C1C1E', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '16px' },
  authButton: { width: '100%', padding: '15px', backgroundColor: '#0A84FF', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' },
  timerText: { fontSize: '48px', fontWeight: 'bold', textAlign: 'center', margin: '0 0 30px 0' },
  topBar: { display: 'flex', justifyContent: 'space-between', padding: '20px', alignItems: 'center' },
  mainBtn: { width: '100%', padding: '16px', backgroundColor: '#FFF', color: '#000', borderRadius: '30px', fontWeight: 'bold', border: 'none', fontSize: '16px', cursor: 'pointer' },
  discardBtn: { width: '100%', padding: '16px', backgroundColor: '#1C1C1E', color: '#FF453A', borderRadius: '30px', fontWeight: 'bold', border: 'none', fontSize: '16px', cursor: 'pointer' },
  deleteBtn: { backgroundColor: 'rgba(255, 69, 58, 0.1)', color: '#FF453A', border: 'none', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
  calendarContainer: { display: 'flex', justifyContent: 'space-between', backgroundColor: '#0A0A0A', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #1C1C1E' },
  calendarDay: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '40px', height: '55px', borderRadius: '8px' },
  historyCard: { backgroundColor: '#1C1C1E', padding: '20px', borderRadius: '12px', marginBottom: '15px' },
  historyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #2C2C2E', paddingBottom: '15px', marginBottom: '15px' },
  
  globalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', backgroundColor: '#0A0A0A', borderBottom: '1px solid #1C1C1E', zIndex: 40 },
  menuButton: { background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: '28px', cursor: 'pointer', padding: 0 },
  menuOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(4px)' },
  menuContent: { backgroundColor: '#1C1C1E', width: '250px', height: '100%', padding: '20px 0', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #2C2C2E', boxShadow: '-5px 0 15px rgba(0,0,0,0.5)' },
  closeMenuBtn: { fontSize: '24px', color: '#8E8E93', cursor: 'pointer', paddingRight: '20px' },
  menuItem: { background: 'transparent', border: 'none', fontSize: '22px', fontWeight: 'bold', textAlign: 'left', cursor: 'pointer', padding: '15px 20px', transition: 'all 0.2s', width: '100%' },
  
  historyExerciseBlock: { marginTop: '10px', backgroundColor: '#0A0A0A', borderRadius: '8px', padding: '12px' },
  historyExerciseTitle: { margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold', color: '#0A84FF' },
  historySetRow: { display: 'flex', alignItems: 'center', fontSize: '14px', color: '#8E8E93', padding: '6px 0' },
  dottedLine: { flex: 1, borderBottom: '2px dotted #2C2C2E', margin: '0 15px', transform: 'translateY(-3px)' },

  exerciseBlock: { padding: '0 20px 20px 20px', borderBottom: '1px solid #1C1C1E', marginBottom: '20px' },
  exerciseHeader: { marginBottom: '15px' },
  exerciseName: { margin: '0', fontSize: '18px', fontWeight: 'bold' },
  tableHeader: { display: 'flex', color: '#8E8E93', fontSize: '13px', fontWeight: '600', marginBottom: '10px' },
  setRow: { display: 'flex', alignItems: 'center', marginBottom: '6px', padding: '4px 0', borderRadius: '8px' },
  setCol: { flex: 0.5, textAlign: 'center', fontWeight: 'bold', color: '#8E8E93' },
  prevCol: { flex: 1, textAlign: 'center', color: '#8E8E93', fontSize: '14px' },
  inputColTitle: { flex: 1, textAlign: 'center' },
  inputCol: { flex: 1, margin: '0 5px' },
  checkCol: { flex: 0.5, display: 'flex', justifyContent: 'center' },
  inputField: { width: '100%', backgroundColor: '#1C1C1E', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '10px 0', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', outline: 'none' },
  checkButton: { width: '32px', height: '32px', borderRadius: '50%', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  addSetText: { color: '#8E8E93', fontSize: '15px', fontWeight: '600', cursor: 'pointer', padding: '10px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000', zIndex: 100, display: 'flex', flexDirection: 'column' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #1C1C1E', backgroundColor: '#0A0A0A' },
  exerciseListItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #1C1C1E', cursor: 'pointer' },
  navArrow: { backgroundColor: 'transparent', color: '#0A84FF', border: 'none', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', transition: 'opacity 0.2s' }
};