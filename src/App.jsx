import React, { useState, useEffect } from 'react';

const EXERCISE_DATABASE = {
  "Chest": ["Flat Barbell Bench Press", "Incline Dumbbell Press", "Cable Crossovers", "Dips", "Pec Deck Flyes"],
  "Back": ["Barbell Deadlift", "Pull-ups", "Lat Pulldowns", "Barbell Bent-Over Row", "Seated Cable Row", "Face Pulls"],
  "Shoulders": ["Overhead Military Press", "Dumbbell Lateral Raises", "Arnold Press", "Reverse Pec Deck", "Upright Rows"],
  "Legs": ["Barbell Squat", "Romanian Deadlift (RDL)", "Leg Press", "Bulgarian Split Squats", "Leg Extensions", "Calf Raises"],
  "Arms": ["Barbell Bicep Curls", "Tricep Rope Pushdowns", "Skull Crushers", "Hammer Curls", "Preacher Curls"],
  "Core": ["Hanging Leg Raises", "Cable Crunches", "Plank", "Russian Twists", "Ab Wheel Rollouts"]
};

export default function App() {
  const [activeTab, setActiveTab] = useState('workout');
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [activeWorkout, setActiveWorkout] = useState({});
  const [workoutTitle, setWorkoutTitle] = useState("Premium Session A");

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('eliteFitnessHistory')) || [];
    setWorkoutHistory(history);
  }, []);

  const updateSet = (exercise, setIndex, field, value) => {
    const updatedWorkout = { ...activeWorkout };
    if (!updatedWorkout[exercise]) {
      updatedWorkout[exercise] = [{ reps: '', weight: '', completed: false }];
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

  const finishWorkout = () => {
    if (Object.keys(activeWorkout).length === 0) return alert("Log data to proceed.");
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      title: workoutTitle,
      data: activeWorkout
    };

    const newHistory = [newEntry, ...workoutHistory];
    setWorkoutHistory(newHistory);
    localStorage.setItem('eliteFitnessHistory', JSON.stringify(newHistory));
    
    setActiveWorkout({});
    setActiveTab('history');
  };

  return (
    <div style={styles.appContainer}>
      {activeTab === 'workout' ? (
        <div style={styles.contentScroll}>
          <header style={styles.header}>
            <div style={{ flex: 1 }}>
              <input 
                style={styles.workoutTitleInput} 
                value={workoutTitle} 
                onChange={(e) => setWorkoutTitle(e.target.value)} 
              />
              <p style={styles.timerText}>Tracking via Local Encryption</p>
            </div>
            <button onClick={finishWorkout} style={styles.finishButton}>Complete</button>
          </header>

          {Object.entries(EXERCISE_DATABASE).map(([category, exercises]) => (
            <div key={category} style={styles.categorySection}>
              <h2 style={styles.categoryTitle}>{category}</h2>
              
              {exercises.map(exercise => {
                const sets = activeWorkout[exercise] || [{ reps: '', weight: '', completed: false }];
                
                return (
                  <div key={exercise} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <h3 style={styles.exerciseName}>{exercise}</h3>
                    </div>

                    <div style={styles.tableHeader}>
                      <span style={{flex: 0.5, textAlign: 'center'}}>SET</span>
                      <span style={{flex: 1, textAlign: 'center'}}>PREV</span>
                      <span style={{flex: 1, textAlign: 'center'}}>KG</span>
                      <span style={{flex: 1, textAlign: 'center'}}>REPS</span>
                      <span style={{flex: 0.5, textAlign: 'center'}}>✓</span>
                    </div>

                    {sets.map((set, idx) => (
                      <div key={idx} style={{
                        ...styles.setRow, 
                        backgroundColor: set.completed ? 'rgba(10, 132, 255, 0.1)' : 'transparent',
                        borderLeft: set.completed ? '3px solid #0A84FF' : '3px solid transparent'
                      }}>
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
                          style={{
                            ...styles.checkButton, 
                            backgroundColor: set.completed ? '#0A84FF' : '#1C1C1E',
                            color: set.completed ? '#FFFFFF' : '#48484A'
                          }}
                        >
                          ✓
                        </button>
                      </div>
                    ))}
                    
                    <button onClick={() => addSet(exercise)} style={styles.addSetButton}>
                      + ADD SET
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.contentScroll}>
          <header style={styles.header}>
            <h1 style={{margin: 0, fontSize: '24px', fontWeight: '700', color: '#FFFFFF'}}>Training Log</h1>
          </header>
          {workoutHistory.length === 0 ? (
            <p style={{padding: '20px', color: '#8E8E93', textAlign: 'center'}}>No historical data established.</p>
          ) : (
            <div style={{padding: '15px'}}>
              {workoutHistory.map(entry => (
                <div key={entry.id} style={styles.historyCard}>
                  <div style={styles.historyHeader}>
                    <h3 style={{margin: 0, fontSize: '18px', color: '#FFFFFF'}}>{entry.title}</h3>
                    <p style={{color: '#0A84FF', fontSize: '12px', margin: 0}}>{entry.date}</p>
                  </div>
                  {Object.entries(entry.data).map(([exName, exSets]) => {
                    const completedSets = exSets.filter(s => s.completed).length;
                    if (completedSets === 0) return null;
                    return (
                      <div key={exName} style={styles.historyDetail}>
                        <span style={{color: '#0A84FF', fontWeight: 'bold'}}>{completedSets} SETS</span>
                        <span style={{color: '#D1D1D6', marginLeft: '10px'}}>{exName}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <nav style={styles.bottomNav}>
        <button 
          style={{...styles.navButton, color: activeTab === 'workout' ? '#FFFFFF' : '#48484A'}}
          onClick={() => setActiveTab('workout')}
        >
          <span style={{...styles.navIndicator, backgroundColor: activeTab === 'workout' ? '#0A84FF' : 'transparent'}} />
          TRAIN
        </button>
        <button 
          style={{...styles.navButton, color: activeTab === 'history' ? '#FFFFFF' : '#48484A'}}
          onClick={() => setActiveTab('history')}
        >
          <span style={{...styles.navIndicator, backgroundColor: activeTab === 'history' ? '#0A84FF' : 'transparent'}} />
          HISTORY
        </button>
      </nav>
    </div>
  );
}

// Global Gym Premium UI/UX Design System
const styles = {
  appContainer: {
    display: 'flex', flexDirection: 'column', height: '100vh', 
    backgroundColor: '#000000', // Deep Obsidian
    color: '#FFFFFF',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'
  },
  contentScroll: {
    flex: 1, overflowY: 'auto', paddingBottom: '90px'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
    padding: '20px 20px 15px 20px', backgroundColor: 'rgba(0, 0, 0, 0.85)', 
    backdropFilter: 'blur(10px)', borderBottom: '1px solid #1C1C1E', 
    position: 'sticky', top: 0, zIndex: 10
  },
  workoutTitleInput: {
    fontSize: '24px', fontWeight: '700', color: '#FFFFFF', backgroundColor: 'transparent',
    border: 'none', outline: 'none', width: '100%', letterSpacing: '-0.5px'
  },
  timerText: {
    fontSize: '12px', color: '#8E8E93', margin: '4px 0 0 0', textTransform: 'uppercase', letterSpacing: '1px'
  },
  finishButton: {
    backgroundColor: '#0A84FF', color: '#FFFFFF', border: 'none', borderRadius: '8px', 
    padding: '10px 24px', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
    letterSpacing: '0.5px', textTransform: 'uppercase'
  },
  categorySection: {
    padding: '20px 15px 0 15px'
  },
  categoryTitle: {
    fontSize: '14px', color: '#0A84FF', textTransform: 'uppercase', 
    letterSpacing: '2px', marginBottom: '15px', marginLeft: '5px', fontWeight: '600'
  },
  card: {
    backgroundColor: '#0A0A0A', border: '1px solid #1C1C1E', borderRadius: '12px', 
    padding: '20px', marginBottom: '20px'
  },
  cardHeader: {
    marginBottom: '20px'
  },
  exerciseName: {
    margin: 0, fontSize: '18px', fontWeight: '600', color: '#FFFFFF', letterSpacing: '-0.3px'
  },
  tableHeader: {
    display: 'flex', fontSize: '11px', color: '#8E8E93', fontWeight: '600', 
    marginBottom: '15px', letterSpacing: '1px'
  },
  setRow: {
    display: 'flex', alignItems: 'center', marginBottom: '10px', padding: '6px 0', 
    borderRadius: '6px', transition: 'all 0.3s ease'
  },
  setIndex: {
    flex: 0.5, textAlign: 'center', fontWeight: '600', color: '#8E8E93'
  },
  prevText: {
    flex: 1, textAlign: 'center', color: '#48484A', fontSize: '14px'
  },
  inputField: {
    flex: 1, backgroundColor: '#1C1C1E', border: 'none', borderRadius: '6px', color: '#FFFFFF',
    padding: '12px 10px', margin: '0 4px', textAlign: 'center', fontSize: '16px', fontWeight: '600'
  },
  checkButton: {
    flex: 0.5, height: '40px', border: 'none', borderRadius: '6px', 
    fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', 
    alignItems: 'center', transition: 'background-color 0.2s ease'
  },
  addSetButton: {
    width: '100%', marginTop: '15px', padding: '12px', backgroundColor: 'transparent', 
    border: '1px dashed #2C2C2E', borderRadius: '8px', color: '#0A84FF', 
    fontSize: '13px', fontWeight: '700', cursor: 'pointer', letterSpacing: '1px'
  },
  historyCard: {
    backgroundColor: '#0A0A0A', border: '1px solid #1C1C1E', borderRadius: '12px', 
    padding: '20px', marginBottom: '15px'
  },
  historyHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1px solid #1C1C1E', paddingBottom: '15px', marginBottom: '15px'
  },
  historyDetail: {
    fontSize: '14px', padding: '8px 0', display: 'flex', alignItems: 'center'
  },
  bottomNav: {
    display: 'flex', justifyContent: 'space-around', padding: '10px 0 25px 0', 
    backgroundColor: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(10px)',
    borderTop: '1px solid #1C1C1E', position: 'fixed', bottom: 0, width: '100%'
  },
  navButton: {
    backgroundColor: 'transparent', border: 'none', fontSize: '11px', 
    fontWeight: '700', cursor: 'pointer', letterSpacing: '1.5px', 
    display: 'flex', flexDirection: 'column', alignItems: 'center'
  },
  navIndicator: {
    width: '4px', height: '4px', borderRadius: '50%', marginBottom: '6px'
  }
};