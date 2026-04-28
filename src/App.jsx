import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";

// 1. YOUR FIREBASE CONFIGURATION
// Replace this with the config from your Firebase Console
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

export default function App() {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [activeTab, setActiveTab] = useState('workout'); 
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null); // The history filter state
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeWorkout, setActiveWorkout] = useState({});
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [seconds, setSeconds] = useState(0);

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

  // --- HELPER FUNCTIONS ---
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentWeek = () => {
    const curr = new Date();
    // Shift the baseline date by the offset multiplier (7 days per week)
    curr.setDate(curr.getDate() + (weekOffset * 7));
    
    const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1); 
    const week = [];
    
    for (let i = 0; i < 7; i++) {
      let next = new Date(curr.getTime());
      next.setDate(first + i);
      
      // Strict validation to ensure the "Today" border only highlights the actual current day
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

  // The optimized addSet with auto-fill logic
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
    if (window.confirm("Delete this workout from your cloud history? This cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "history", entryId));
      } catch (error) { alert("Failed to delete: " + error.message); }
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
                          <span style={styles.prevCol}>—</span>
                          <div style={styles.inputCol}><input type="number" placeholder="0" value={set.weight} onChange={(e) => updateSet(exercise, idx, 'weight', e.target.value)} style={styles.inputField} /></div>
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

        {/* HISTORY TAB WITH CHRONOLOGICAL NAVIGATION */}
        {activeTab === 'history' && (
          <div style={{padding: '20px'}}>
            <h1 style={{fontSize: '28px', marginBottom: '20px'}}>Your Progress</h1>
            
            {/* NAVIGATION CONTROLS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <button 
                onClick={() => { setWeekOffset(w => w - 1); setSelectedDate(null); }} 
                style={styles.navArrow}
              >
                ◀ Past
              </button>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {weekOffset === 0 ? "Current Week" : `${Math.abs(weekOffset)} Week(s) Ago`}
              </span>
              <button 
                onClick={() => { setWeekOffset(w => w + 1); setSelectedDate(null); }} 
                disabled={weekOffset === 0} 
                style={{ ...styles.navArrow, opacity: weekOffset === 0 ? 0.2 : 1 }}
              >
                Future ▶
              </button>
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
                    const completedSets = exSets.filter(s => s.completed).length;
                    if (completedSets === 0) return null;
                    return (
                      <div key={exName} style={styles.historyDetail}>
                        <span style={{color: '#8E8E93', width: '60px'}}>{completedSets} sets</span>
                        <span>{exName}</span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'you' && (
          <div style={{padding: '20px', textAlign: 'center'}}>
            <h2 style={{fontSize: '24px', marginBottom: '40px'}}>Profile</h2>
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
          <div style={{overflowY: 'auto', paddingBottom: '50px'}}>
            {Object.entries(EXERCISE_DATABASE).map(([category, exercises]) => (
              <div key={category} style={{padding: '10px 20px'}}>
                <h3 style={{color: '#0A84FF', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '10px'}}>{category}</h3>
                {exercises.map(ex => (
                  <div key={ex} onClick={() => addExerciseToWorkout(ex)} style={styles.exerciseListItem}>
                    <span style={{fontSize: '16px'}}>{ex}</span>
                    <span style={{color: '#0A84FF', fontSize: '24px', fontWeight: '300'}}>+</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav style={styles.bottomNav}>
        {['Workout', 'History', 'You'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())} 
            style={{...styles.navBtn, color: activeTab === tab.toLowerCase() ? '#FFFFFF' : '#48484A'}}>
            {tab}
          </button>
        ))}
      </nav>
    </div>
  );
}

// 3. DESIGN SYSTEM 
const styles = {
  appContainer: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#000000', color: '#FFFFFF', fontFamily: '-apple-system, sans-serif' },
  contentScroll: { flex: 1, overflowY: 'auto', paddingBottom: '90px' },
  authInput: { width: '100%', padding: '15px', marginBottom: '15px', backgroundColor: '#1C1C1E', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '16px' },
  authButton: { width: '100%', padding: '15px', backgroundColor: '#0A84FF', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' },
  timerText: { fontSize: '48px', fontWeight: 'bold', textAlign: 'center', margin: '0 0 30px 0' },
  topBar: { display: 'flex', justifyContent: 'space-between', padding: '20px', alignItems: 'center' },
  mainBtn: { width: '100%', padding: '16px', backgroundColor: '#FFF', color: '#000', borderRadius: '30px', fontWeight: 'bold', border: 'none', fontSize: '16px', cursor: 'pointer' },
  discardBtn: { width: '100%', padding: '16px', backgroundColor: '#1C1C1E', color: '#FF453A', borderRadius: '30px', fontWeight: 'bold', border: 'none', fontSize: '16px', cursor: 'pointer' },
  deleteBtn: { backgroundColor: 'rgba(255, 69, 58, 0.1)', color: '#FF453A', border: 'none', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
  calendarContainer: { display: 'flex', justifyContent: 'space-between', backgroundColor: '#0A0A0A', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #1C1C1E' },
  calendarDay: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '40px', height: '55px', borderRadius: '8px' },
  bottomNav: { display: 'flex', justifyContent: 'space-around', padding: '15px 0 25px 0', backgroundColor: '#000', borderTop: '1px solid #1C1C1E', position: 'fixed', bottom: 0, width: '100%', zIndex: 50 },
  navBtn: { backgroundColor: 'transparent', border: 'none', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer' },
  historyCard: { backgroundColor: '#1C1C1E', padding: '20px', borderRadius: '12px', marginBottom: '15px' },
  historyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #2C2C2E', paddingBottom: '15px', marginBottom: '15px' },
  historyDetail: { display: 'flex', fontSize: '15px', padding: '6px 0' },
  exerciseBlock: { padding: '0 20px 20px 20px', borderBottom: '1px solid #1C1C1E', marginBottom: '20px' },
  exerciseHeader: { marginBottom: '15px' },
  exerciseName: { margin: 0, fontSize: '18px', fontWeight: 'bold' },
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