import React, { useState, useEffect } from 'react';

// 1. Comprehensive Exercise Database
// 1. Comprehensive Exercise Database (Updated)
const EXERCISE_DATABASE = {
  "Chest": [
    "Bench Press", "Incline Dumbbell Press", "Cable Crossovers", "Dips",
    "Low Incline Dumbbell Press", "Flat Dumbbell Fly", "Deficit Push-up"
  ],
  "Back": [
    "Barbell Deadlift", "Pull-ups", "Lat Pulldowns", "Barbell Row",
    "Lat Prayer (Straight Arm Pulldown)", "Deficit Barbell Row"
  ],
  "Shoulders": [
    "Overhead Press", "Lateral Raises", "Arnold Press", "Face Pulls",
    "Seated Dumbbell Lateral Raise", "Super ROM Lateral Raise"
  ],
  "Legs": [
    "Barbell Squat", "Romanian Deadlift", "Leg Press", "Calf Raises",
    "High Bar Squat", "Hack Squat", "Reverse Nordic", 
    "Front Foot Elevated Smith Lunge", "Glute Thrust Machine", 
    "Sit Back Squat", "Stiff Legged Deadlift", "Seated/Lying Leg Curl"
  ],
  "Arms": [
    "Bicep Curls", "Triceps Pushdown", "Skull Crushers", "Hammer Curls",
    "Seated Overhead Tricep Extension", "Dip Machine",
    "Decline Dumbbell Curl", "Incline Dumbbell Curl", "Superman Cable Curl"
  ],
  "Core": [
    "Hanging Leg Raises", "Cable Crunches", "Plank"
  ]
};

export default function App() {
  const [activeTab, setActiveTab] = useState('workout'); // 'home' (History) or 'workout' (Active)
  const [workoutHistory, setWorkoutHistory] = useState([]);
  
  // Active Workout State
  const [activeWorkout, setActiveWorkout] = useState({});
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // Initialize History from Local Storage
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('lyftaCloneHistory')) || [];
    setWorkoutHistory(history);
  }, []);

  // Timer Logic
  useEffect(() => {
    let interval = null;
    if (isWorkoutActive) {
      interval = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isWorkoutActive]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Workout Controls
  const startWorkout = () => {
    setIsWorkoutActive(true);
    setSeconds(0);
    setActiveWorkout({});
  };

  const addExerciseToWorkout = (exerciseName) => {
    if (!activeWorkout[exerciseName]) {
      setActiveWorkout(prev => ({
        ...prev,
        [exerciseName]: [{ reps: '', weight: '', completed: false }]
      }));
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
    updated[exercise].push({ reps: '', weight: '', completed: false });
    setActiveWorkout(updated);
  };

  const toggleSetCompletion = (exercise, setIndex) => {
    const updated = { ...activeWorkout };
    updated[exercise][setIndex].completed = !updated[exercise][setIndex].completed;
    setActiveWorkout(updated);
  };

  const finishWorkout = () => {
    if (Object.keys(activeWorkout).length === 0) {
      alert("Cannot save an empty workout.");
      return;
    }

    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      duration: formatTime(seconds),
      data: activeWorkout
    };

    const newHistory = [newEntry, ...workoutHistory];
    setWorkoutHistory(newHistory);
    localStorage.setItem('lyftaCloneHistory', JSON.stringify(newHistory));
    
    setIsWorkoutActive(false);
    setActiveWorkout({});
    setActiveTab('home'); // Redirect to history
  };

  const discardWorkout = () => {
    if(window.confirm("Are you sure you want to discard this workout?")) {
      setIsWorkoutActive(false);
      setActiveWorkout({});
      setSeconds(0);
    }
  };

  // --- RENDER HELPERS ---

  const renderHomeTab = () => (
    <div style={styles.contentScroll}>
      <header style={{padding: '20px'}}>
        <h1 style={{margin: 0, fontSize: '28px', color: '#FFFFFF'}}>Your Progress</h1>
        <p style={{color: '#8E8E93', margin: '5px 0 20px 0'}}>Review your local workout history.</p>
      </header>
      
      {workoutHistory.length === 0 ? (
        <div style={{textAlign: 'center', marginTop: '50px', color: '#8E8E93'}}>
          <p>Your library is empty.</p>
          <button onClick={() => setActiveTab('workout')} style={styles.addExerciseBtn}>Start an Empty Workout</button>
        </div>
      ) : (
        <div style={{padding: '0 20px'}}>
          {workoutHistory.map(entry => (
            <div key={entry.id} style={styles.historyCard}>
              <div style={styles.historyHeader}>
                <h3 style={{margin: 0, fontSize: '18px'}}>{entry.date}</h3>
                <span style={{color: '#0A84FF', fontWeight: 'bold'}}>{entry.duration}</span>
              </div>
              {Object.entries(entry.data).map(([exName, exSets]) => {
                const completedSets = exSets.filter(s => s.completed).length;
                if (completedSets === 0) return null;
                return (
                  <div key={exName} style={styles.historyDetail}>
                    <span style={{color: '#8E8E93', width: '60px'}}>{completedSets} sets</span>
                    <span style={{color: '#FFFFFF'}}>{exName}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderWorkoutTab = () => {
    if (!isWorkoutActive) {
      return (
        <div style={{...styles.contentScroll, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px'}}>
          <h2 style={{fontSize: '24px', marginBottom: '10px'}}>Ready to train?</h2>
          <button onClick={startWorkout} style={{...styles.addExerciseBtn, width: '100%'}}>Start an Empty Workout</button>
        </div>
      );
    }

    return (
      <div style={styles.contentScroll}>
        <div style={styles.topBar}>
          <span style={{color: '#8E8E93', fontSize: '20px', cursor: 'pointer'}} onClick={discardWorkout}>▼</span>
          <span style={{color: '#0A84FF', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer'}} onClick={finishWorkout}>Finish</span>
        </div>
        
        <h1 style={styles.timerText}>{formatTime(seconds)}</h1>

        {Object.entries(activeWorkout).length === 0 ? (
          <div style={{textAlign: 'center', color: '#8E8E93', marginTop: '20px'}}>
            <p>Get Started</p>
            <p style={{fontSize: '14px'}}>Add exercises to start your workout</p>
          </div>
        ) : (
          Object.entries(activeWorkout).map(([exercise, sets]) => (
            <div key={exercise} style={styles.exerciseBlock}>
              <div style={styles.exerciseHeader}>
                <div style={styles.exerciseTitleGroup}>
                  <div style={styles.thumbnailPlaceholder}><span style={{color: '#8E8E93'}}>🏋️</span></div>
                  <div>
                    <h3 style={styles.exerciseName}>{exercise}</h3>
                    <p style={styles.restTimerText}>⏱ Rest Timer: Off</p>
                  </div>
                </div>
                <span style={{color: '#8E8E93', fontSize: '20px'}}>⋮</span>
              </div>

              <div style={styles.tableHeader}>
                <span style={styles.setCol}>Set</span>
                <span style={styles.prevCol}>Previous</span>
                <span style={styles.inputColTitle}>kg</span>
                <span style={styles.inputColTitle}>Reps</span>
                <span style={styles.checkCol}>✓</span>
              </div>

              {sets.map((set, idx) => (
                <div key={idx} style={{
                  ...styles.setRow, 
                  backgroundColor: set.completed ? 'rgba(52, 199, 89, 0.15)' : 'transparent'
                }}>
                  <span style={styles.setCol}>{idx + 1}</span>
                  <span style={styles.prevCol}>—</span>
                  <div style={styles.inputCol}>
                    <input 
                      type="number" placeholder="0" value={set.weight}
                      onChange={(e) => updateSet(exercise, idx, 'weight', e.target.value)}
                      style={{...styles.inputField, borderBottom: set.completed ? 'none' : '2px solid #0A84FF'}} 
                    />
                  </div>
                  <div style={styles.inputCol}>
                    <input 
                      type="number" placeholder="0" value={set.reps}
                      onChange={(e) => updateSet(exercise, idx, 'reps', e.target.value)}
                      style={{...styles.inputField, borderBottom: set.completed ? 'none' : '2px solid transparent'}} 
                    />
                  </div>
                  <div style={styles.checkCol}>
                    <button 
                      onClick={() => toggleSetCompletion(exercise, idx)}
                      style={{
                        ...styles.checkButton, 
                        backgroundColor: set.completed ? '#34C759' : '#2C2C2E',
                        color: set.completed ? '#FFFFFF' : '#8E8E93'
                      }}
                    >
                      ✓
                    </button>
                  </div>
                </div>
              ))}
              
              <div style={{textAlign: 'center', marginTop: '15px'}}>
                <span onClick={() => addSet(exercise)} style={styles.addSetText}>+ Add Set</span>
              </div>
            </div>
          ))
        )}

        <div style={styles.actionButtons}>
          <button onClick={() => setShowExerciseModal(true)} style={styles.addExerciseBtn}>Add Exercises</button>
          <button onClick={discardWorkout} style={styles.discardBtn}>Discard Workout</button>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.appContainer}>
      
      {/* Dynamic Tab Rendering */}
      {activeTab === 'home' ? renderHomeTab() : renderWorkoutTab()}

      {/* Full Screen Exercise Selection Modal */}
      {showExerciseModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalHeader}>
            <span onClick={() => setShowExerciseModal(false)} style={{fontSize: '24px', cursor: 'pointer'}}>✕</span>
            <h2 style={{margin: 0, fontSize: '18px'}}>Add Exercises</h2>
            <span style={{width: '24px'}}></span> {/* Spacer */}
          </div>
          <div style={{overflowY: 'auto', paddingBottom: '50px'}}>
            {Object.entries(EXERCISE_DATABASE).map(([category, exercises]) => (
              <div key={category} style={{padding: '10px 20px'}}>
                <h3 style={{color: '#0A84FF', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px'}}>{category}</h3>
                {exercises.map(ex => (
                  <div key={ex} onClick={() => addExerciseToWorkout(ex)} style={styles.exerciseListItem}>
                    <span style={{fontSize: '16px'}}>{ex}</span>
                    <span style={{color: '#0A84FF', fontSize: '20px'}}>+</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav style={styles.bottomNav}>
        {[
          { id: 'home', icon: '🏠', label: 'Home' },
          { id: 'explore', icon: '🔍', label: 'Explore' },
          { id: 'workout', icon: '➕', label: 'Workout' },
          { id: 'progress', icon: '📈', label: 'Progress' },
          { id: 'you', icon: '👤', label: 'You' }
        ].map(tab => (
          <div key={tab.id} style={styles.navItem} onClick={() => setActiveTab(tab.id)}>
            <span style={{fontSize: '22px', filter: activeTab === tab.id ? 'grayscale(0%)' : 'grayscale(100%) opacity(50%)'}}>
              {tab.icon}
            </span>
            <span style={{...styles.navText, color: activeTab === tab.id ? '#FFFFFF' : '#8E8E93'}}>
              {tab.label}
            </span>
          </div>
        ))}
      </nav>
    </div>
  );
}

// STYLESHEET
const styles = {
  appContainer: {
    display: 'flex', flexDirection: 'column', height: '100vh', 
    backgroundColor: '#000000', color: '#FFFFFF',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
  },
  contentScroll: {
    flex: 1, overflowY: 'auto', paddingBottom: '90px'
  },
  topBar: {
    display: 'flex', justifyContent: 'space-between', padding: '15px 20px', alignItems: 'center'
  },
  timerText: {
    fontSize: '48px', fontWeight: 'bold', textAlign: 'center', margin: '0 0 20px 0', letterSpacing: '1px'
  },
  exerciseBlock: {
    padding: '0 20px 20px 20px', borderBottom: '1px solid #1C1C1E', marginBottom: '20px'
  },
  exerciseHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px'
  },
  exerciseTitleGroup: {
    display: 'flex', gap: '15px'
  },
  thumbnailPlaceholder: {
    width: '45px', height: '45px', backgroundColor: '#1C1C1E', borderRadius: '8px',
    display: 'flex', justifyContent: 'center', alignItems: 'center'
  },
  exerciseName: {
    margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold'
  },
  restTimerText: {
    margin: 0, color: '#8E8E93', fontSize: '13px'
  },
  tableHeader: {
    display: 'flex', color: '#8E8E93', fontSize: '13px', fontWeight: '600', marginBottom: '10px'
  },
  setRow: {
    display: 'flex', alignItems: 'center', marginBottom: '6px', padding: '4px 0', borderRadius: '8px'
  },
  setCol: { flex: 0.5, textAlign: 'center', fontWeight: 'bold', color: '#8E8E93' },
  prevCol: { flex: 1, textAlign: 'center', color: '#8E8E93', fontSize: '14px' },
  inputColTitle: { flex: 1, textAlign: 'center' },
  inputCol: { flex: 1, margin: '0 5px' },
  checkCol: { flex: 0.5, display: 'flex', justifyContent: 'center' },
  inputField: {
    width: '100%', backgroundColor: '#1C1C1E', color: '#FFFFFF', border: 'none', borderRadius: '6px', 
    padding: '10px 0', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', outline: 'none'
  },
  checkButton: {
    width: '32px', height: '32px', borderRadius: '50%', border: 'none', 
    display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer',
    fontSize: '14px', fontWeight: 'bold', transition: 'all 0.2s ease'
  },
  addSetText: {
    color: '#8E8E93', fontSize: '15px', fontWeight: '600', cursor: 'pointer', padding: '10px'
  },
  actionButtons: {
    padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px'
  },
  addExerciseBtn: {
    backgroundColor: '#FFFFFF', color: '#000000', border: 'none', borderRadius: '30px', 
    padding: '16px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer'
  },
  discardBtn: {
    backgroundColor: 'transparent', color: '#FF453A', border: 'none', 
    fontSize: '16px', fontWeight: '600', cursor: 'pointer'
  },
  historyCard: {
    backgroundColor: '#1C1C1E', borderRadius: '12px', padding: '20px', marginBottom: '15px'
  },
  historyHeader: {
    display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid #2C2C2E', paddingBottom: '10px'
  },
  historyDetail: {
    display: 'flex', fontSize: '15px', padding: '5px 0'
  },
  bottomNav: {
    display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '10px 0 25px 0', 
    backgroundColor: '#000000', borderTop: '1px solid #1C1C1E', position: 'fixed', bottom: 0, width: '100%', zIndex: 50
  },
  navItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer'
  },
  navText: { fontSize: '10px', fontWeight: '500' },
  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000', zIndex: 100, display: 'flex', flexDirection: 'column'
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #1C1C1E'
  },
  exerciseListItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #1C1C1E', cursor: 'pointer'
  }
};