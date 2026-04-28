import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, onSnapshot, addDoc } from "firebase/firestore";

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
  "Legs": ["Barbell Squat", "High Bar Squat", "Hack Squat", "Leg Press", "Reverse Nordic", "RDL", "Stiff Legged Deadlift", "Seated/Lying Leg Curl", "Calf Raises"],
  "Arms": ["Bicep Curls", "Triceps Pushdown", "Skull Crushers", "Hammer Curls", "Overhead Extension", "Dip Machine", "Superman Cable Curl"],
  "Core": ["Hanging Leg Raises", "Cable Crunches", "Plank"]
};

// 3. MAIN APPLICATION COMPONENT
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('workout'); 
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [activeWorkout, setActiveWorkout] = useState({});
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // AUTHENTICATION OBSERVER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // LOAD HISTORY FROM FIRESTORE
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

  // TIMER LOGIC
  useEffect(() => {
    let interval = null;
    if (isWorkoutActive) {
      interval = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isWorkoutActive]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // WORKOUT CONTROLS
  const startWorkout = () => { setIsWorkoutActive(true); setSeconds(0); setActiveWorkout({}); };

  const finishWorkout = async () => {
    if (Object.keys(activeWorkout).length === 0) return alert("Log data to proceed.");
    
    try {
      await addDoc(collection(db, "users", user.uid, "history"), {
        timestamp: Date.now(),
        date: new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        duration: formatTime(seconds),
        data: activeWorkout
      });
      setIsWorkoutActive(false);
      setActiveWorkout({});
      setActiveTab('history');
    } catch (e) {
      alert("Error saving workout: " + e.message);
    }
  };

  // AUTH HANDLERS
  const handleAuth = async (type) => {
    try {
      if (type === 'signup') await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (e) { alert(e.message); }
  };

  // --- RENDER HELPERS ---
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
        {activeTab === 'workout' && (
          <div>
            <div style={styles.topBar}>
              <span style={{color: '#8E8E93', fontSize: '20px'}} onClick={() => setIsWorkoutActive(false)}>▼</span>
              <span style={{color: '#0A84FF', fontWeight: 'bold'}} onClick={finishWorkout}>Finish</span>
            </div>
            <h1 style={styles.timerText}>{formatTime(seconds)}</h1>
            {!isWorkoutActive ? (
              <button onClick={startWorkout} style={styles.mainBtn}>Start Workout</button>
            ) : (
              <div>
                {/* Exercise blocks and set management here (previous logic) */}
                <button onClick={() => setShowExerciseModal(true)} style={styles.mainBtn}>+ Add Exercise</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div style={{padding: '20px'}}>
            <h2 style={{fontSize: '24px', marginBottom: '20px'}}>History</h2>
            {workoutHistory.map(entry => (
              <div key={entry.id} style={styles.historyCard}>
                <div style={styles.historyHeader}>
                  <p>{entry.date}</p>
                  <p style={{color: '#0A84FF'}}>{entry.duration}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'you' && (
          <div style={{padding: '20px', textAlign: 'center'}}>
            <h2 style={{fontSize: '24px', marginBottom: '40px'}}>Profile</h2>
            <div style={{backgroundColor: '#1C1C1E', padding: '20px', borderRadius: '12px', marginBottom: '20px'}}>
              <p style={{color: '#8E8E93'}}>Logged in as:</p>
              <p style={{fontSize: '18px', fontWeight: 'bold'}}>{user.email}</p>
            </div>
            <button onClick={() => signOut(auth)} style={{...styles.authButton, backgroundColor: '#FF453A'}}>Sign Out</button>
          </div>
        )}
      </div>

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

// 4. THE DESIGN SYSTEM
const styles = {
  appContainer: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#000000', color: '#FFFFFF', fontFamily: '-apple-system, sans-serif' },
  contentScroll: { flex: 1, overflowY: 'auto', paddingBottom: '90px' },
  authInput: { width: '100%', padding: '15px', marginBottom: '15px', backgroundColor: '#1C1C1E', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '16px' },
  authButton: { width: '100%', padding: '15px', backgroundColor: '#0A84FF', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' },
  timerText: { fontSize: '48px', fontWeight: 'bold', textAlign: 'center', margin: '30px 0' },
  topBar: { display: 'flex', justifyContent: 'space-between', padding: '20px' },
  mainBtn: { width: '90%', margin: '0 5% 20px 5%', padding: '15px', backgroundColor: '#FFF', color: '#000', borderRadius: '30px', fontWeight: 'bold', border: 'none' },
  bottomNav: { display: 'flex', justifyContent: 'space-around', padding: '15px 0 30px 0', backgroundColor: '#000', borderTop: '1px solid #1C1C1E', position: 'fixed', bottom: 0, width: '100%' },
  navBtn: { backgroundColor: 'transparent', border: 'none', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' },
  historyCard: { backgroundColor: '#1C1C1E', padding: '15px', borderRadius: '12px', marginBottom: '10px' },
  historyHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '14px' }
};