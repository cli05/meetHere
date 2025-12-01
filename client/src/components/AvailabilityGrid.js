import React, { useState, useRef, useEffect } from 'react';
import './AvailabilityGrid.css';

const AvailabilityGrid = ({ isCreator = false, onUpdate }) => {
  const [selectedSlots, setSelectedSlots] = useState(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isPaintMode, setIsPaintMode] = useState(false);
  const [dragMode, setDragMode] = useState(null); // 'select' or 'deselect'
  const gridRef = useRef(null);

  // Generate time slots (9 AM to 9 PM in 30-minute intervals)
  const timeSlots = [];
  for (let hour = 9; hour <= 21; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 21 && minute > 0) break; // Stop at 9:00 PM
      const time = `${hour > 12 ? hour - 12 : hour}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
      timeSlots.push(time);
    }
  }

  // Generate days (next 7 days)
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push({
      name: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      full: date,
    });
  }

  const getCellId = (dayIndex, timeIndex) => `${dayIndex}-${timeIndex}`;

  const handleMouseDown = (dayIndex, timeIndex) => {
    if (isPaintMode) return;
    
    setIsDragging(true);
    const cellId = getCellId(dayIndex, timeIndex);
    const newSelected = new Set(selectedSlots);
    
    if (newSelected.has(cellId)) {
      newSelected.delete(cellId);
      setDragMode('deselect');
    } else {
      newSelected.add(cellId);
      setDragMode('select');
    }
    
    setSelectedSlots(newSelected);
  };

  const handleMouseEnter = (dayIndex, timeIndex) => {
    if (!isDragging || isPaintMode) return;
    
    const cellId = getCellId(dayIndex, timeIndex);
    const newSelected = new Set(selectedSlots);
    
    if (dragMode === 'select') {
      newSelected.add(cellId);
    } else if (dragMode === 'deselect') {
      newSelected.delete(cellId);
    }
    
    setSelectedSlots(newSelected);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMode(null);
  };

  const handleTouchStart = (dayIndex, timeIndex) => {
    if (!isPaintMode) return;
    
    const cellId = getCellId(dayIndex, timeIndex);
    const newSelected = new Set(selectedSlots);
    
    if (newSelected.has(cellId)) {
      newSelected.delete(cellId);
    } else {
      newSelected.add(cellId);
    }
    
    setSelectedSlots(newSelected);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp();
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  useEffect(() => {
    if (onUpdate) {
      onUpdate({ selectedSlots: Array.from(selectedSlots) });
    }
  }, [selectedSlots]);

  const getOpacity = (dayIndex, timeIndex) => {
    const cellId = getCellId(dayIndex, timeIndex);
    if (selectedSlots.has(cellId)) {
      return 1;
    }
    return 0.2;
  };

  return (
    <div className="availability-grid-container">
      <div className="grid-controls">
        <div className="control-group">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={isPaintMode}
              onChange={(e) => setIsPaintMode(e.target.checked)}
            />
            <span>Mobile Paint Mode (Touch)</span>
          </label>
        </div>
        <div className="control-info">
          {isPaintMode ? (
            <span>📱 Tap cells to toggle availability</span>
          ) : (
            <span>🖱️ Click and drag to select times</span>
          )}
        </div>
      </div>

      <div 
        className="availability-grid" 
        ref={gridRef}
        onMouseLeave={handleMouseUp}
      >
        <div className="grid-header">
          <div className="grid-cell header-cell time-header">Time</div>
          {days.map((day, index) => (
            <div key={index} className="grid-cell header-cell">
              <div className="day-name">{day.name}</div>
              <div className="day-date">{day.date}</div>
            </div>
          ))}
        </div>

        <div className="grid-body">
          {timeSlots.map((time, timeIndex) => (
            <div key={timeIndex} className="grid-row">
              <div className="grid-cell time-cell">{time}</div>
              {days.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`grid-cell selectable-cell ${
                    selectedSlots.has(getCellId(dayIndex, timeIndex)) ? 'selected' : ''
                  }`}
                  style={{
                    backgroundColor: 'var(--purdue-gold)',
                    opacity: getOpacity(dayIndex, timeIndex),
                  }}
                  onMouseDown={() => handleMouseDown(dayIndex, timeIndex)}
                  onMouseEnter={() => handleMouseEnter(dayIndex, timeIndex)}
                  onTouchStart={() => handleTouchStart(dayIndex, timeIndex)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="grid-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: 'var(--purdue-gold)', opacity: 1 }}></div>
          <span>Available</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: 'var(--purdue-gold)', opacity: 0.2 }}></div>
          <span>Not Available</span>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityGrid;
