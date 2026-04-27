import React, { useState, useEffect } from 'react';

// Simplified Database for Demonstration
const EXERCISE_DATABASE = [
  {
    category: "Chest",
    exercises: ["Flat Bench Press", "Incline Bench Press", "Chest Flyes"]
  },
  {
    category: "Back",
    exercises: ["Pull-ups", "Lat Pulldowns", "Barbell Rows", "Deadlifts"]
  },
  {
    category: "Legs",
    exercises: ["Squats", "Romanian Deadlifts", "Calf Raises"]
  }
];

export default function App() {
  const [currentDate, setCurrentDate] = useState('');
  const [workoutData, setWorkoutData] = useState({});

  // Initialize System Date & Retrieve Stored Data
  useEffect(() => {
    // Set exact chronological date
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    setCurrentDate(today);

    // Retrieve historical data from local device storage
    const savedData = localStorage.getItem('hypertrophyLogs');
    if (savedData) {
      setWorkoutData(JSON.parse(savedData));
    }
  }, []);

  // Handle Input Modification
  const handleInputChange = (exercise, metric, value) => {
    setWorkoutData(prev => ({
      ...prev,
      [exercise]: {
        ...prev[exercise],
        [metric]: value
      }
    }));
  };

  // Commit Data to Device Storage
  const commitWorkout = () => {
    localStorage.setItem('hypertrophyLogs', JSON.stringify(workoutData));
    alert('Metrics successfully synchronized to local device storage.');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui', backgroundColor: '#121212', color: '#fff', minHeight: '100vh' }}>
      <header style={{ borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, color: '#03DAC6' }}>Hypertrophy Tracker</h1>
        <p style={{ margin: 0, color: '#aaa' }}>{currentDate}</p>
      </header>

      {EXERCISE_DATABASE.map((section, index) => (
        <section key={index} style={{ marginBottom: '30px' }}>
          <h2 style={{ color: '#BB86FC', borderBottom: '1px solid #333', paddingBottom: '5px' }}>
            {section.category}
          </h2>
          {section.exercises.map((exercise, idx) => (
            <div key={idx} style={{ padding: '10px 0', display: 'flex', flexDirection: 'column' }}>
              <span style={{ marginBottom: '8px', fontWeight: 'bold' }}>{exercise}</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="number" 
                  placeholder="Weight (kg)" 
                  value={workoutData[exercise]?.weight || ''}
                  onChange={(e) => handleInputChange(exercise, 'weight', e.target.value)}
                  style={inputStyle} 
                />
                <input 
                  type="number" 
                  placeholder="Sets" 
                  value={workoutData[exercise]?.sets || ''}
                  onChange={(e) => handleInputChange(exercise, 'sets', e.target.value)}
                  style={inputStyle} 
                />
                <input 
                  type="number" 
                  placeholder="Reps" 
                  value={workoutData[exercise]?.reps || ''}
                  onChange={(e) => handleInputChange(exercise, 'reps', e.target.value)}
                  style={inputStyle} 
                />
              </div>
            </div>
          ))}
        </section>
      ))}

      <button 
        onClick={commitWorkout}
        style={{ width: '100%', padding: '15px', backgroundColor: '#03DAC6', color: '#000', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginTop: '20px' }}>
        Commit Daily Log
      </button>
    </div>
  );
}

const inputStyle = {
  flex: 1, padding: '10px', borderRadius: '5px', border: 'none', backgroundColor: '#2C2C2C', color: '#fff', textAlign: 'center'
};