import React, { useState, useEffect } from 'react';

// 1. Comprehensive Exercise Database
const EXERCISE_DATABASE = {
  "Chest": ["Flat Barbell Bench Press", "Incline Dumbbell Press", "Cable Crossovers", "Dips", "Pec Deck Flyes"],
  "Back": ["Barbell Deadlift", "Pull-ups", "Lat Pulldowns", "Barbell Bent-Over Row", "Seated Cable Row", "Face Pulls"],
  "Shoulders": ["Overhead Military Press", "Dumbbell Lateral Raises", "Arnold Press", "Reverse Pec Deck", "Upright Rows"],
  "Legs": ["Barbell Squat", "Romanian Deadlift (RDL)", "Leg Press", "Bulgarian Split Squats", "Leg Extensions", "Calf Raises"],
  "Arms": ["Barbell Bicep Curls", "Tricep Rope Pushdowns", "Skull Crushers", "Hammer Curls", "Preacher Curls"],
  "Core": ["Hanging Leg Raises", "Cable Crunches", "Plank", "Russian Twists", "Ab Wheel Rollouts"]
};

export default function App() {
  const [activeTab, setActiveTab] = useState('workout'); // 'workout' or 'history'
  const [workoutHistory, setWorkoutHistory] = useState([]);
  
  // State for the active workout session
  const [activeWorkout, setActiveWorkout] = useState({});
  const [workoutTitle, setWorkoutTitle] = useState("Hypertrophy Session A");
  const [startTime, setStartTime] = useState(Date.now());

  // Initialization: Load history from Local Storage
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('fitnessHistory')) || [];
    setWorkoutHistory(history);
  }, []);

  // Handle Input for Active Workout
  const updateSet = (exercise, setIndex, field, value) => {
    const updatedWorkout = { ...activeWorkout };
    if (!updatedWorkout[exercise]) {
      // Initialize exercise with 3 default sets if it doesn't exist
      updatedWorkout[exercise] = [{ reps: '', weight: '', completed: false }, { reps: '', weight: '', completed: false }, { reps: '', weight: '', completed: false }];
    }
    updatedWorkout[exercise][setIndex][field] = value;
    setActiveWorkout(updatedWorkout);
  };

  const addSet = (exercise) => {
    const updatedWorkout = { ...activeWorkout };
    if (!updatedWorkout[exercise]) updatedWorkout[exercise] = [];
    updatedWorkout[exercise].push({ reps: '', weight: '', completed: false });
    setActiveWorkout(updatedWorkout);
  };

  const toggleSetCompletion = (exercise, setIndex) => {
    const updatedWorkout = { ...activeWorkout };
    updatedWorkout[exercise][setIndex].completed = !updatedWorkout[exercise][setIndex].completed;
    setActiveWorkout(updatedWorkout);
  };

  // Save Workout to History
  const finishWorkout = () => {
    if (Object.keys(activeWorkout).length === 0) return alert("Add some exercises first!");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      title: workoutTitle,
      data: activeWorkout
    };

    const newHistory = [newEntry, ...workoutHistory];
    setWorkoutHistory(newHistory);
    localStorage.setItem('fitnessHistory', JSON.stringify(newHistory));
    
    // Reset active workout
    setActiveWorkout({});
    setStartTime(Date.now());
    alert('Workout securely logged to device storage.');
    setActiveTab('history');
  };

  return (
    <div style={styles.appContainer}>
      {/* Dynamic Render based on Tab */}
      {activeTab === 'workout' ? (
        <div style={styles.contentScroll}>
          <header style={styles.header}>
            <div>
              <input 
                style={styles.workoutTitleInput} 
                value={workoutTitle} 
                onChange={(e) => setWorkoutTitle(e.target.value)} 
              />
              <p style={styles.timerText}>Recording Session...</p>
            </div>
            <button onClick={finishWorkout} style={styles.finishButton}>Finish</button>
          </header>

          {/* Render All Categories and Exercises */}
          {Object.entries(EXERCISE_DATABASE).map(([category, exercises]) => (
            <div key={category} style={styles.categorySection}>
              <h2 style={styles.categoryTitle}>{category}</h2>
              
              {exercises.map(exercise => {
                const sets = activeWorkout[exercise] || [{ reps: '', weight: '', completed: false }];
                
                return (
                  <div key={exercise} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <h3 style={styles.exerciseName}>{exercise}</h3>
                      <span style={styles.moreOptionsIcon}>•••</span>
                    </div>

                    <div style={styles.tableHeader}>
                      <span style={{flex: 0.5, textAlign: 'center'}}>SET</span>
                      <span style={{flex: 1, textAlign: 'center'}}>PREV</span>
                      <span style={{flex: 1, textAlign: 'center'}}>KG</span>
                      <span style={{flex: 1, textAlign: 'center'}}>REPS</span>
                      <span style={{flex: 0.5, textAlign: 'center'}}>✓</span>
                    </div>

                    {sets.map((set, idx) => (
                      <div key={idx} style={{...styles.setRow, backgroundColor: set.completed ? '#E8F5E9' : 'transparent'}}>
                        <span style={styles.setIndex}>{idx + 1}</span>
                        <span style={styles.prevText}>-</span>
                        <input 
                          type="number" 
                          placeholder="0" 
                          value={set.weight}
                          onChange={(e) => updateSet(exercise, idx, 'weight', e.target.value)}
                          style={styles.inputField} 
                        />
                        <input 
                          type="number" 
                          placeholder="0" 
                          value={set.reps}
                          onChange={(e) => updateSet(exercise, idx, 'reps', e.target.value)}
                          style={styles.inputField} 
                        />
                        <button 
                          onClick={() => toggleSetCompletion(exercise, idx)}
                          style={{...styles.checkButton, backgroundColor: set.completed ? '#34C759' : '#E5E5EA'}}
                        >
                          ✓
                        </button>
                      </div>
                    ))}
                    
                    <button onClick={() => addSet(exercise)} style={styles.addSetButton}>
                      + Add Set
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.contentScroll}>
          <h1 style={{padding: '20px', fontSize: '28px', fontWeight: 'bold'}}>Workout History</h1>
          {workoutHistory.length === 0 ? (
            <p style={{padding: '20px', color: '#8E8E93'}}>No previous workouts logged.</p>
          ) : (
            workoutHistory.map(entry => (
              <div key={entry.id} style={styles.historyCard}>
                <h3 style={{margin: '0 0 5px 0', fontSize: '18px'}}>{entry.title}</h3>
                <p style={{color: '#8E8E93', fontSize: '14px', margin: '0 0 15px 0'}}>{entry.date}</p>
                {Object.entries(entry.data).map(([exName, exSets]) => {
                  const completedSets = exSets.filter(s => s.completed).length;
                  if (completedSets === 0) return null;
                  return (
                    <div key={exName} style={{fontSize: '14px', borderBottom: '1px solid #E5E5EA', padding: '8px 0'}}>
                      <strong>{completedSets} sets</strong> - {exName}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}

      {/* Bottom Navigation */}
      <nav style={styles.bottomNav}>
        <button 
          style={{...styles.navButton, color: activeTab === 'workout' ? '#007AFF' : '#8E8E93'}}
          onClick={() => setActiveTab('workout')}
        >
          Workout
        </button>
        <button 
          style={{...styles.navButton, color: activeTab === 'history' ? '#007AFF' : '#8E8E93'}}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </nav>
    </div>
  );
}

// 2. iOS-Inspired Styling
const styles = {
  appContainer: {
    display: 'flex', flexDirection: 'column', height: '100vh', 
    backgroundColor: '#F2F2F7', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  contentScroll: {
    flex: 1, overflowY: 'auto', paddingBottom: '80px'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
    padding: '20px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E5EA', position: 'sticky', top: 0, zIndex: 10
  },
  workoutTitleInput: {
    fontSize: '22px', fontWeight: 'bold', border: 'none', outline: 'none', width: '100%'
  },
  timerText: {
    fontSize: '14px', color: '#8E8E93', margin: '5px 0 0 0'
  },
  finishButton: {
    backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '20px', 
    padding: '8px 20px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer'
  },
  categorySection: {
    padding: '10px 15px'
  },
  categoryTitle: {
    fontSize: '18px', color: '#8E8E93', textTransform: 'uppercase', marginBottom: '10px', marginLeft: '5px'
  },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '15px', 
    marginBottom: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'
  },
  exerciseName: {
    margin: 0, fontSize: '18px', fontWeight: '600', color: '#000'
  },
  moreOptionsIcon: {
    color: '#007AFF', fontSize: '20px', fontWeight: 'bold'
  },
  tableHeader: {
    display: 'flex', fontSize: '12px', color: '#8E8E93', fontWeight: '600', marginBottom: '10px'
  },
  setRow: {
    display: 'flex', alignItems: 'center', marginBottom: '8px', padding: '4px 0', borderRadius: '8px'
  },
  setIndex: {
    flex: 0.5, textAlign: 'center', fontWeight: 'bold', color: '#8E8E93'
  },
  prevText: {
    flex: 1, textAlign: 'center', color: '#C7C7CC', fontSize: '14px'
  },
  inputField: {
    flex: 1, backgroundColor: '#F2F2F7', border: 'none', borderRadius: '8px', 
    padding: '10px', margin: '0 4px', textAlign: 'center', fontSize: '16px', fontWeight: '600'
  },
  checkButton: {
    flex: 0.5, height: '35px', border: 'none', borderRadius: '8px', 
    color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center'
  },
  addSetButton: {
    width: '100%', marginTop: '10px', padding: '10px', backgroundColor: 'transparent', 
    border: 'none', color: '#007AFF', fontSize: '16px', fontWeight: '500', cursor: 'pointer'
  },
  historyCard: {
    backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '20px', 
    margin: '10px 15px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
  },
  bottomNav: {
    display: 'flex', justifyContent: 'space-around', padding: '15px', 
    backgroundColor: '#FFFFFF', borderTop: '1px solid #E5E5EA', position: 'fixed', bottom: 0, width: '100%'
  },
  navButton: {
    backgroundColor: 'transparent', border: 'none', fontSize: '16px', fontWeight: '600', cursor: 'pointer'
  }
};