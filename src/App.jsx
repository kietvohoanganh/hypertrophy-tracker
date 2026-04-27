import React, { useState, useEffect } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('workout'); // Home, Explore, Workout, Progress, You
  
  // Giả lập trạng thái một buổi tập đang diễn ra giống trong video
  const [activeWorkout, setActiveWorkout] = useState({
    "Bench Press": [
      { reps: '8', weight: '85', completed: true },
      { reps: '6', weight: '85', completed: true },
      { reps: '', weight: '', completed: false }
    ],
    "Triceps Pushdown": [
      { reps: '', weight: '', completed: false },
      { reps: '', weight: '', completed: false }
    ]
  });

  // Đồng hồ bấm giờ buổi tập
  const [seconds, setSeconds] = useState(15);
  useEffect(() => {
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `00:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const updateSet = (exercise, setIndex, field, value) => {
    const updatedWorkout = { ...activeWorkout };
    updatedWorkout[exercise][setIndex][field] = value;
    setActiveWorkout(updatedWorkout);
  };

  const addSet = (exercise) => {
    const updatedWorkout = { ...activeWorkout };
    updatedWorkout[exercise].push({ reps: '', weight: '', completed: false });
    setActiveWorkout(updatedWorkout);
  };

  const toggleSetCompletion = (exercise, setIndex) => {
    const updatedWorkout = { ...activeWorkout };
    updatedWorkout[exercise][setIndex].completed = !updatedWorkout[exercise][setIndex].completed;
    setActiveWorkout(updatedWorkout);
  };

  return (
    <div style={styles.appContainer}>
      {/* KHU VỰC ĐANG TẬP LUYỆN */}
      <div style={styles.contentScroll}>
        <div style={styles.topBar}>
          <span style={{color: '#8E8E93', fontSize: '20px'}}>▼</span>
          <span style={{color: '#8E8E93', fontSize: '20px'}}>⏱</span>
          <span style={{color: '#8E8E93', fontSize: '20px'}}>⋮</span>
        </div>
        
        <h1 style={styles.timerText}>{formatTime(seconds)}</h1>

        {Object.entries(activeWorkout).map(([exercise, sets]) => (
          <div key={exercise} style={styles.exerciseBlock}>
            {/* Header Bài tập */}
            <div style={styles.exerciseHeader}>
              <div style={styles.exerciseTitleGroup}>
                <div style={styles.thumbnailPlaceholder}>
                  <span style={{color: '#8E8E93'}}>🏋️</span>
                </div>
                <div>
                  <h3 style={styles.exerciseName}>{exercise}</h3>
                  <p style={styles.notesText}>Notes...</p>
                  <p style={styles.restTimerText}>⏱ Rest Timer: Off</p>
                </div>
              </div>
              <span style={{color: '#8E8E93', fontSize: '20px'}}>⋮</span>
            </div>

            {/* Tiêu đề Cột */}
            <div style={styles.tableHeader}>
              <span style={styles.setCol}>Set</span>
              <span style={styles.prevCol}>Previous</span>
              <span style={styles.inputColTitle}>kg</span>
              <span style={styles.inputColTitle}>Reps</span>
              <span style={styles.checkCol}>✓</span>
            </div>

            {/* Danh sách Sets */}
            {sets.map((set, idx) => (
              <div key={idx} style={{
                ...styles.setRow, 
                backgroundColor: set.completed ? 'rgba(52, 199, 89, 0.1)' : 'transparent'
              }}>
                <span style={styles.setCol}>{idx + 1}</span>
                <span style={styles.prevCol}>—</span>
                <div style={styles.inputCol}>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={set.weight}
                    onChange={(e) => updateSet(exercise, idx, 'weight', e.target.value)}
                    style={{...styles.inputField, borderBottom: set.completed ? 'none' : '2px solid #0A84FF'}} 
                  />
                </div>
                <div style={styles.inputCol}>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={set.reps}
                    onChange={(e) => updateSet(exercise, idx, 'reps', e.target.value)}
                    style={styles.inputField} 
                  />
                </div>
                <div style={styles.checkCol}>
                  <button 
                    onClick={() => toggleSetCompletion(exercise, idx)}
                    style={{
                      ...styles.checkButton, 
                      backgroundColor: set.completed ? '#34C759' : '#1C1C1E',
                      color: set.completed ? '#FFFFFF' : '#8E8E93'
                    }}
                  >
                    ✓
                  </button>
                </div>
              </div>
            ))}
            
            <div style={{textAlign: 'center', marginTop: '10px'}}>
              <span onClick={() => addSet(exercise)} style={styles.addSetText}>+ Add Set</span>
            </div>
          </div>
        ))}

        {/* Các Nút Hành Động Cuối Trang */}
        <div style={styles.actionButtons}>
          <button style={styles.addExerciseBtn}>Add Exercises</button>
          <button style={styles.discardBtn}>Discard Workout</button>
        </div>
      </div>

      {/* THANH ĐIỀU HƯỚNG BOTTOM NAV */}
      <nav style={styles.bottomNav}>
        {['Home', 'Explore', 'Workout', 'Progress', 'You'].map(tab => (
          <div key={tab} style={styles.navItem} onClick={() => setActiveTab(tab.toLowerCase())}>
            <span style={{...styles.navIcon, color: tab === 'Workout' ? '#FFFFFF' : '#8E8E93'}}>
              {tab === 'Workout' ? '➕' : '○'}
            </span>
            <span style={{...styles.navText, color: tab === 'Workout' ? '#FFFFFF' : '#8E8E93'}}>
              {tab}
            </span>
          </div>
        ))}
      </nav>
    </div>
  );
}

// BỘ ĐỊNH DẠNG CSS THEO CHUẨN LYFTA APP
const styles = {
  appContainer: {
    display: 'flex', flexDirection: 'column', height: '100vh', 
    backgroundColor: '#000000', color: '#FFFFFF',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'
  },
  contentScroll: {
    flex: 1, overflowY: 'auto', paddingBottom: '100px'
  },
  topBar: {
    display: 'flex', justifyContent: 'space-between', padding: '15px 20px', alignItems: 'center'
  },
  timerText: {
    fontSize: '48px', fontWeight: 'bold', textAlign: 'center', margin: '0 0 30px 0', letterSpacing: '2px'
  },
  exerciseBlock: {
    padding: '0 20px 30px 20px',
    borderBottom: '1px solid #1C1C1E',
    marginBottom: '20px'
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
    margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold', letterSpacing: '-0.5px'
  },
  notesText: {
    margin: 0, color: '#8E8E93', fontSize: '14px', marginBottom: '4px'
  },
  restTimerText: {
    margin: 0, color: '#8E8E93', fontSize: '14px', display: 'flex', alignItems: 'center'
  },
  tableHeader: {
    display: 'flex', color: '#8E8E93', fontSize: '13px', fontWeight: '600', marginBottom: '10px'
  },
  setRow: {
    display: 'flex', alignItems: 'center', marginBottom: '8px', padding: '4px 0', borderRadius: '8px'
  },
  setCol: { flex: 0.5, textAlign: 'center', fontWeight: 'bold', color: '#8E8E93' },
  prevCol: { flex: 1, textAlign: 'center', color: '#8E8E93', fontSize: '14px' },
  inputColTitle: { flex: 1, textAlign: 'center' },
  inputCol: { flex: 1, margin: '0 5px' },
  checkCol: { flex: 0.5, display: 'flex', justifyContent: 'center' },
  inputField: {
    width: '100%', backgroundColor: '#1C1C1E', color: '#FFFFFF', border: 'none', borderRadius: '8px', 
    padding: '12px 0', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', outline: 'none'
  },
  checkButton: {
    width: '34px', height: '34px', borderRadius: '50%', border: 'none', 
    display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer',
    fontSize: '16px', fontWeight: 'bold', transition: 'all 0.2s ease'
  },
  addSetText: {
    color: '#8E8E93', fontSize: '15px', fontWeight: '600', cursor: 'pointer', padding: '10px'
  },
  actionButtons: {
    padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '15px'
  },
  addExerciseBtn: {
    backgroundColor: '#FFFFFF', color: '#000000', border: 'none', borderRadius: '30px', 
    padding: '18px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer'
  },
  discardBtn: {
    backgroundColor: 'transparent', color: '#FF453A', border: 'none', 
    fontSize: '16px', fontWeight: '600', cursor: 'pointer'
  },
  bottomNav: {
    display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '10px 0 25px 0', 
    backgroundColor: '#000000', borderTop: '1px solid #1C1C1E', position: 'fixed', bottom: 0, width: '100%'
  },
  navItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer'
  },
  navIcon: { fontSize: '22px' },
  navText: { fontSize: '11px', fontWeight: '500' }
};