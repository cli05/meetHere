const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const Participant = require('../models/Participant');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Create a new meeting (Protected)
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, availableDays, timeRange, timezone, locationConstraint, creatorLocation } = req.body;

    console.log('Creating meeting for user:', req.user._id);

    const meeting = new Meeting({
      name,
      description,
      availableDays,
      timeRange,
      timezone: timezone || 'America/New_York',
      locationConstraint: locationConstraint || { enabled: false },
      creatorLocation: creatorLocation || null,
      createdBy: req.user._id,
    });

    await meeting.save();

    // Add meeting to user's meetings array
    await User.findByIdAndUpdate(req.user._id, {
      $push: { meetings: meeting._id }
    });

    console.log('Meeting created:', meeting.shareLink);

    res.status(201).json({ 
      success: true, 
      meeting,
      shareLink: meeting.shareLink,
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user's meetings (Protected) - Must come before /:shareLink
router.get('/my-meetings', protect, async (req, res) => {
  try {
    const meetings = await Meeting.find({ createdBy: req.user._id })
      .populate('participants')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, count: meetings.length, meetings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get meeting by share link
router.get('/:shareLink', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ shareLink: req.params.shareLink })
      .populate('participants');

    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    res.json({ success: true, meeting });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get optimal locations for a meeting
router.get('/:shareLink/optimal-locations', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ shareLink: req.params.shareLink })
      .populate('participants');

    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    const optimalLocations = findOptimalLocations(meeting.participants, meeting);
    
    res.json({ success: true, optimalLocations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all meetings (for admin/testing)
router.get('/', async (req, res) => {
  try {
    const meetings = await Meeting.find().populate('participants');
    res.json({ success: true, meetings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update meeting (recalculate optimal time/location)
router.put('/:shareLink', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ shareLink: req.params.shareLink })
      .populate('participants');

    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    // Calculate optimal time
    const optimalTime = calculateOptimalTime(meeting.participants);
    meeting.optimalTime = optimalTime;

    // Calculate optimal location
    const optimalLocation = calculateOptimalLocation(meeting.participants);
    meeting.optimalLocation = optimalLocation;

    await meeting.save();
    res.json({ success: true, meeting });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete meeting
router.delete('/:shareLink', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ shareLink: req.params.shareLink });
    
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    // Delete all participants
    await Participant.deleteMany({ meetingId: meeting._id });
    
    // Delete meeting
    await Meeting.deleteOne({ _id: meeting._id });

    res.json({ success: true, message: 'Meeting deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to calculate optimal meeting time
function calculateOptimalTime(participants) {
  if (!participants || participants.length === 0) {
    return null;
  }

  // Count availability for each time slot
  const timeSlotCounts = {};
  
  participants.forEach(participant => {
    participant.availability.forEach(slot => {
      const key = `${slot.dayIndex}-${slot.timeIndex}`;
      timeSlotCounts[key] = (timeSlotCounts[key] || 0) + 1;
    });
  });

  // Find time slot with maximum participants
  let maxCount = 0;
  let bestSlot = null;

  for (const [key, count] of Object.entries(timeSlotCounts)) {
    if (count > maxCount) {
      maxCount = count;
      bestSlot = key;
    }
  }

  if (bestSlot) {
    const [dayIndex, timeIndex] = bestSlot.split('-').map(Number);
    return {
      dayIndex,
      timeIndex,
      participantCount: maxCount,
    };
  }

  return null;
}

// Helper function to calculate optimal location (geographic center)
function calculateOptimalLocation(participants) {
  if (!participants || participants.length === 0) {
    return null;
  }

  const locations = participants
    .filter(p => p.location && p.location.coordinates)
    .map(p => p.location.coordinates);

  if (locations.length === 0) {
    return null;
  }

  // Calculate geographic center
  const avgLat = locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length;
  const avgLng = locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length;

  // For MVP, return the center coordinates
  // In production, use Google Maps API to find nearest building
  return {
    coordinates: {
      lat: avgLat,
      lng: avgLng,
    },
    buildingName: 'Calculated Center Point',
    buildingAbbr: 'CENTER',
  };
}

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Helper function to find optimal meeting locations from Purdue buildings
function findOptimalLocations(participants, meeting) {
  const campusBuildings = [
    { id: 1, name: 'Lawson Computer Science Building', abbr: 'LWSN', lat: 40.4283, lng: -86.9162 },
    { id: 2, name: 'Hicks Undergraduate Library', abbr: 'HICKS', lat: 40.4264, lng: -86.9214 },
    { id: 3, name: 'Wilmeth Active Learning Center', abbr: 'WALC', lat: 40.4279, lng: -86.9166 },
    { id: 4, name: 'Electrical Engineering Building', abbr: 'EE', lat: 40.4282, lng: -86.9169 },
    { id: 5, name: 'Mathematical Sciences Building', abbr: 'MATH', lat: 40.4271, lng: -86.9152 },
    { id: 6, name: 'Recitation Building', abbr: 'REC', lat: 40.4268, lng: -86.9203 },
    { id: 7, name: 'Haas Hall', abbr: 'HAAS', lat: 40.4254, lng: -86.9189 },
    { id: 8, name: 'Stanley Coulter Hall', abbr: 'SC', lat: 40.4255, lng: -86.9208 },
    { id: 9, name: 'Stewart Center', abbr: 'STEW', lat: 40.4265, lng: -86.9186 },
    { id: 10, name: 'Armstrong Hall', abbr: 'ARMS', lat: 40.4276, lng: -86.9194 },
  ];

  // Get all participant locations (including creator if they set one)
  const participantLocations = [];
  
  // Add creator location if exists
  if (meeting.creatorLocation && meeting.creatorLocation.coordinates) {
    participantLocations.push(meeting.creatorLocation.coordinates);
  }
  
  // Add participant locations
  participants.forEach(p => {
    if (p.location && p.location.coordinates) {
      participantLocations.push(p.location.coordinates);
    }
  });

  if (participantLocations.length === 0) {
    return [];
  }

  // Calculate total distance from each building to all participants
  const buildingScores = campusBuildings.map(building => {
    let totalDistance = 0;
    let maxDistance = 0;
    
    participantLocations.forEach(location => {
      const distance = calculateDistance(
        building.lat, building.lng,
        location.lat, location.lng
      );
      totalDistance += distance;
      maxDistance = Math.max(maxDistance, distance);
    });

    const avgDistance = totalDistance / participantLocations.length;

    return {
      ...building,
      avgDistance: Math.round(avgDistance), // meters
      maxDistance: Math.round(maxDistance), // meters
      totalDistance: Math.round(totalDistance),
      fairnessScore: Math.round(maxDistance - avgDistance), // Lower is more fair
    };
  });

  // Sort by average distance (best locations first)
  buildingScores.sort((a, b) => a.avgDistance - b.avgDistance);

  // Return top 5 locations
  return buildingScores.slice(0, 5);
}

module.exports = router;
