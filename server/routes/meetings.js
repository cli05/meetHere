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
    // Academic Buildings
    { id: 1, name: 'Lawson Computer Science Building', abbr: 'LWSN', lat: 40.42833, lng: -86.91620 },
    { id: 2, name: 'Wilmeth Active Learning Center', abbr: 'WALC', lat: 40.42789, lng: -86.91663 },
    { id: 3, name: 'Mathematical Sciences Building', abbr: 'MATH', lat: 40.42712, lng: -86.91523 },
    { id: 4, name: 'Electrical Engineering Building', abbr: 'EE', lat: 40.42822, lng: -86.91694 },
    { id: 5, name: 'Felix Haas Hall', abbr: 'HAAS', lat: 40.42540, lng: -86.91895 },
    { id: 6, name: 'Recitation Building', abbr: 'REC', lat: 40.42680, lng: -86.92030 },
    { id: 7, name: 'Stanley Coulter Hall', abbr: 'SC', lat: 40.42550, lng: -86.92080 },
    { id: 8, name: 'Physics Building', abbr: 'PHYS', lat: 40.42846, lng: -86.91560 },
    { id: 9, name: 'Lily Hall', abbr: 'LILY', lat: 40.42398, lng: -86.91632 },
    { id: 10, name: 'Class of 1950 Lecture Hall', abbr: 'CL50', lat: 40.42562, lng: -86.91740 },
    
    // Engineering Buildings
    { id: 11, name: 'Armstrong Hall of Engineering', abbr: 'ARMS', lat: 40.42761, lng: -86.91939 },
    { id: 12, name: 'Grissom Hall', abbr: 'GRIS', lat: 40.42683, lng: -86.91896 },
    { id: 13, name: 'Mechanical Engineering Building', abbr: 'ME', lat: 40.42910, lng: -86.91800 },
    { id: 14, name: 'Materials and Electrical Engineering Building', abbr: 'MSEE', lat: 40.42767, lng: -86.91620 },
    { id: 15, name: 'Neil Armstrong Hall of Engineering', abbr: 'NEIL', lat: 40.42842, lng: -86.91879 },
    { id: 16, name: 'Civil Engineering Building', abbr: 'CE', lat: 40.42946, lng: -86.91673 },
    { id: 17, name: 'Chaffee Hall', abbr: 'CHAF', lat: 40.42804, lng: -86.91483 },
    
    // Libraries
    { id: 18, name: 'Hicks Undergraduate Library', abbr: 'HICKS', lat: 40.42643, lng: -86.92140 },
    { id: 19, name: 'Humanities Social Sciences and Education Library', abbr: 'HSSE', lat: 40.42505, lng: -86.92148 },
    { id: 20, name: 'Mathematical Sciences Library', abbr: 'MLIB', lat: 40.42712, lng: -86.91523 },
    
    // Student Centers & Unions
    { id: 21, name: 'Purdue Memorial Union', abbr: 'PMU', lat: 40.42346, lng: -86.91911 },
    { id: 22, name: 'Stewart Center', abbr: 'STEW', lat: 40.42650, lng: -86.91860 },
    { id: 23, name: 'Cordova Recreational Sports Center', abbr: 'CREC', lat: 40.42230, lng: -86.92205 },
    { id: 24, name: 'France A. Córdova Recreational Sports Center', abbr: 'CoRec', lat: 40.42230, lng: -86.92205 },
    
    // Business & Management
    { id: 25, name: 'Krannert Building', abbr: 'KRAN', lat: 40.42617, lng: -86.91634 },
    { id: 26, name: 'Rawls Hall', abbr: 'RAWL', lat: 40.42650, lng: -86.91580 },
    { id: 27, name: 'Krach Leadership Center', abbr: 'KRCH', lat: 40.42558, lng: -86.91705 },
    
    // Science Buildings
    { id: 28, name: 'Wetherill Laboratory of Chemistry', abbr: 'WTHR', lat: 40.42655, lng: -86.91460 },
    { id: 29, name: 'Brown Laboratory', abbr: 'BRNG', lat: 40.42640, lng: -86.91380 },
    { id: 30, name: 'Biochemistry Building', abbr: 'BCHM', lat: 40.42764, lng: -86.91296 },
    { id: 31, name: 'Hansen Life Sciences Research Building', abbr: 'HANS', lat: 40.42823, lng: -86.91327 },
    { id: 32, name: 'Lilly Hall of Life Sciences', abbr: 'LILY', lat: 40.42398, lng: -86.91632 },
    
    // Agriculture
    { id: 33, name: 'Smith Hall', abbr: 'SMTH', lat: 40.42456, lng: -86.91344 },
    { id: 34, name: 'Pfendler Hall', abbr: 'PFEN', lat: 40.42504, lng: -86.91280 },
    { id: 35, name: 'Agricultural Administration Building', abbr: 'AGAD', lat: 40.42580, lng: -86.91420 },
    
    // Arts & Humanities
    { id: 36, name: 'Patti and Rusty Rueff Hall', abbr: 'PRUF', lat: 40.42383, lng: -86.92054 },
    { id: 37, name: 'Yue-Kong Pao Hall of Visual and Performing Arts', abbr: 'YONG', lat: 40.42468, lng: -86.92278 },
    { id: 38, name: 'Elliot Hall of Music', abbr: 'ELLT', lat: 40.42388, lng: -86.92393 },
    { id: 39, name: 'Peirce Hall', abbr: 'PRCE', lat: 40.42425, lng: -86.92154 },
    
    // Residence Halls - Popular Study Locations
    { id: 40, name: 'Earhart Hall', abbr: 'EAR', lat: 40.43172, lng: -86.92482 },
    { id: 41, name: 'First Street Towers', abbr: 'FST', lat: 40.42901, lng: -86.92352 },
    { id: 42, name: 'Hillenbrand Hall', abbr: 'HILL', lat: 40.43068, lng: -86.92693 },
    { id: 43, name: 'Harrison Hall', abbr: 'HARR', lat: 40.43233, lng: -86.92167 },
    { id: 44, name: 'Tarkington Hall', abbr: 'TARK', lat: 40.43066, lng: -86.92037 },
    { id: 45, name: 'Wiley Hall', abbr: 'WILY', lat: 40.43009, lng: -86.91860 },
    { id: 46, name: 'Windsor Halls', abbr: 'WNDS', lat: 40.42643, lng: -86.92563 },
    { id: 47, name: 'Hawkins Hall', abbr: 'HAWK', lat: 40.42774, lng: -86.92742 },
    
    // Administrative Buildings
    { id: 48, name: 'Hovde Hall', abbr: 'HOVD', lat: 40.42472, lng: -86.91816 },
    { id: 49, name: 'Schleman Hall', abbr: 'SCHL', lat: 40.42802, lng: -86.92117 },
    { id: 50, name: 'Young Hall', abbr: 'YONG', lat: 40.42647, lng: -86.91753 },
    
    // Athletic Facilities
    { id: 51, name: 'Mackey Arena', abbr: 'MACK', lat: 40.42329, lng: -86.92097 },
    { id: 52, name: 'Ross-Ade Stadium', abbr: 'ROSS', lat: 40.42344, lng: -86.92330 },
    { id: 53, name: 'Mollenkopf Athletic Center', abbr: 'MAC', lat: 40.42299, lng: -86.92215 },
    
    // Other Important Buildings
    { id: 54, name: 'Knoy Hall', abbr: 'KNOY', lat: 40.42627, lng: -86.91677 },
    { id: 55, name: 'University Hall', abbr: 'UNIV', lat: 40.42647, lng: -86.91880 },
    { id: 56, name: 'Beering Hall', abbr: 'BEER', lat: 40.42508, lng: -86.91685 },
    { id: 57, name: 'Heavilon Hall', abbr: 'HEAV', lat: 40.42593, lng: -86.92073 },
    { id: 58, name: 'Stone Hall', abbr: 'STON', lat: 40.42687, lng: -86.92138 },
    { id: 59, name: 'Civil Engineering Building', abbr: 'CIVL', lat: 40.42946, lng: -86.91673 },
    { id: 60, name: 'Pharmacy Building', abbr: 'PHAR', lat: 40.42435, lng: -86.91502 },
    { id: 61, name: 'Nursing Building', abbr: 'NURS', lat: 40.42508, lng: -86.91402 },
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
