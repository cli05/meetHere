import React, { useState, useRef, useEffect } from 'react';
import './AvailabilityGrid.css';

const AvailabilityGrid = ({
  isCreator = false,
  onUpdate,
  availableDays = [],  // Array of date strings from meeting (e.g., ["2025-12-15", "2025-12-18"])
  timeRange = { startTime: '09:00', endTime: '21:00' }  // Meeting's time range
}) => {
  const [selectedSlots, setSelectedSlots] = useState(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isPaintMode, setIsPaintMode] = useState(false);
  const [dragMode, setDragMode] = useState(null); // 'select' or 'deselect'
  const gridRef = useRef(null);

  // Helper function to generate time slots from time range
  const generateTimeSlots = () => {
    const slots = [];
    const [startHour, startMin] = timeRange.startTime.split(':').map(Number);
    const [endHour, endMin] = timeRange.endTime.split(':').map(Number);

    let currentHour = startHour;
    let currentMin = startMin;

    while (currentHour < endHour || (currentHour === endHour && currentMin <= endMin)) {
      const hour12 = currentHour > 12 ? currentHour - 12 : (currentHour === 0 ? 12 : currentHour);
      const ampm = currentHour >= 12 ? 'PM' : 'AM';
      const time = `${hour12}:${currentMin.toString().padStart(2, '0')} ${ampm}`;
      slots.push(time);

      // Increment by 30 minutes
      currentMin += 30;
      if (currentMin >= 60) {
        currentMin = 0;
        currentHour++;
      }
    }

    return slots;
  };

  // Generate time slots from meeting's time range
  const timeSlots = generateTimeSlots();

  // Generate days from meeting's availableDays
  const days = availableDays.length > 0
    ? availableDays.map(dateStr => {
        const date = new Date(dateStr);
        return {
          name: date.toLocaleDateString('en-US', { weekday: 'short' }),
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          full: date,
          originalDate: dateStr
        };
      })
    : // Fallback to next 7 days if no availableDays provided (shouldn't happen)
      (() => {
        const fallbackDays = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          fallbackDays.push({
            name: date.toLocaleDateString('en-US', { weekday: 'short' }),
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            full: date,
            originalDate: date.toISOString().split('T')[0]
          });
        }
        return fallbackDays;
      })();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      {availableDays.length === 0 && (
        <div style={{
          padding: '12px',
          background: '#ff9800',
          color: 'white',
          borderRadius: '8px',
          marginBottom: '12px',
          textAlign: 'center'
        }}>
          ⚠️ No dates available for this meeting
        </div>
      )}

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

      <div style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
        Showing {days.length} {days.length === 1 ? 'day' : 'days'} •
        {timeSlots.length} time slots ({timeRange.startTime} - {timeRange.endTime})
      </div>
    </div>
  );
};

export default AvailabilityGrid;
