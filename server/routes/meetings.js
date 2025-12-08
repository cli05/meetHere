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
      // Optimal time and location will be calculated when participants join
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

    // Check and update expiration status for all meetings
    await Promise.all(meetings.map(meeting => meeting.checkAndUpdateExpiration()));

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

    // Check and update expiration status
    await meeting.checkAndUpdateExpiration();

    // Block access to expired meetings for new participants
    if (meeting.status === 'expired') {
      return res.status(410).json({
        success: false,
        error: 'This meeting has expired',
        expired: true
      });
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

// Helper function to group consecutive time slots on the same day
function groupConsecutiveSlots(slots) {
  if (slots.length === 0) return [];

  // Sort slots by dayIndex, then timeIndex
  const sortedSlots = [...slots].sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    return a.timeIndex - b.timeIndex;
  });

  const grouped = [];
  let currentGroup = {
    dayIndex: sortedSlots[0].dayIndex,
    startTimeIndex: sortedSlots[0].timeIndex,
    endTimeIndex: sortedSlots[0].timeIndex,
    participantCount: sortedSlots[0].participantCount,
    everyoneAvailable: sortedSlots[0].everyoneAvailable
  };

  for (let i = 1; i < sortedSlots.length; i++) {
    const slot = sortedSlots[i];

    // If same day and consecutive time slots, extend the current group
    if (slot.dayIndex === currentGroup.dayIndex &&
        slot.timeIndex === currentGroup.endTimeIndex + 1) {
      currentGroup.endTimeIndex = slot.timeIndex;
    } else {
      // Save current group and start a new one
      grouped.push({ ...currentGroup });
      currentGroup = {
        dayIndex: slot.dayIndex,
        startTimeIndex: slot.timeIndex,
        endTimeIndex: slot.timeIndex,
        participantCount: slot.participantCount,
        everyoneAvailable: slot.everyoneAvailable
      };
    }
  }

  // Add the last group
  grouped.push(currentGroup);

  return grouped;
}

// Helper function to calculate optimal meeting time
function calculateOptimalTime(participants) {
  if (!participants || participants.length === 0) {
    return null;
  }

  const totalParticipants = participants.length;

  // Count availability for each time slot
  const timeSlotCounts = {};

  participants.forEach(participant => {
    participant.availability.forEach(slot => {
      const key = `${slot.dayIndex}-${slot.timeIndex}`;
      timeSlotCounts[key] = (timeSlotCounts[key] || 0) + 1;
    });
  });

  // Find all slots where EVERYONE is available
  const perfectSlots = [];
  const bestAlternativeSlots = [];
  let maxCount = 0;

  for (const [key, count] of Object.entries(timeSlotCounts)) {
    if (count === totalParticipants) {
      // Everyone is available at this slot
      const [dayIndex, timeIndex] = key.split('-').map(Number);
      perfectSlots.push({
        dayIndex,
        timeIndex,
        participantCount: count,
        everyoneAvailable: true
      });
    } else {
      // Track the best alternative slots
      if (count > maxCount) {
        maxCount = count;
        bestAlternativeSlots.length = 0; // Clear previous best
        const [dayIndex, timeIndex] = key.split('-').map(Number);
        bestAlternativeSlots.push({
          dayIndex,
          timeIndex,
          participantCount: count,
          everyoneAvailable: false
        });
      } else if (count === maxCount) {
        const [dayIndex, timeIndex] = key.split('-').map(Number);
        bestAlternativeSlots.push({
          dayIndex,
          timeIndex,
          participantCount: count,
          everyoneAvailable: false
        });
      }
    }
  }

  // Group consecutive slots on the same day
  const groupedPerfectSlots = groupConsecutiveSlots(perfectSlots);
  const groupedBestAlternativeSlots = groupConsecutiveSlots(bestAlternativeSlots);

  // Return perfect slots if any exist, otherwise return best alternatives
  if (groupedPerfectSlots.length > 0) {
    return {
      slots: groupedPerfectSlots,
      everyoneAvailable: true,
      message: `${groupedPerfectSlots.length} time range${groupedPerfectSlots.length > 1 ? 's' : ''} where everyone is available`
    };
  } else if (groupedBestAlternativeSlots.length > 0) {
    return {
      slots: groupedBestAlternativeSlots,
      everyoneAvailable: false,
      message: `Best option: ${maxCount} out of ${totalParticipants} participants available`
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
    { id: 2, name: 'Wilmeth Active Learning Center', abbr: 'WALC', lat: 40.42600, lng: -86.91300 },
    { id: 3, name: 'Mathematical Sciences Building', abbr: 'MATH', lat: 40.42500, lng: -86.91500 },
    { id: 4, name: 'Electrical Engineering Building', abbr: 'EE', lat: 40.42670, lng: -86.91620 },
    { id: 5, name: 'Felix Haas Hall', abbr: 'HAAS', lat: 40.42540, lng: -86.91540 },
    { id: 6, name: 'Recitation Building', abbr: 'REC', lat: 40.42540, lng: -86.91540 },
    { id: 7, name: 'Stanley Coulter Hall', abbr: 'SC', lat: 40.42540, lng: -86.91540 },
    { id: 8, name: 'Physics Building', abbr: 'PHYS', lat: 40.42670, lng: -86.91460 },
    { id: 9, name: 'Lilly Hall of Life Sciences', abbr: 'LILY', lat: 40.42360, lng: -86.91700 },
    { id: 10, name: 'Class of 1950 Lecture Hall', abbr: 'CL50', lat: 40.42540, lng: -86.91540 },
    
    // Engineering Buildings
    { id: 11, name: 'Neil Armstrong Hall of Engineering', abbr: 'ARMS', lat: 40.43100, lng: -86.91450 },
    { id: 12, name: 'Grissom Hall', abbr: 'GRIS', lat: 40.42670, lng: -86.91620 },
    { id: 13, name: 'Mechanical Engineering Building', abbr: 'ME', lat: 40.42670, lng: -86.91620 },
    { id: 14, name: 'Materials and Electrical Engineering Building', abbr: 'MSEE', lat: 40.42790, lng: -86.91540 },
    { id: 15, name: 'Civil Engineering Building', abbr: 'CIVL', lat: 40.42670, lng: -86.91460 },
    { id: 16, name: 'Chaffee Hall', abbr: 'CHAF', lat: 40.41510, lng: -86.92080 },
    
    // Libraries
    { id: 17, name: 'Hicks Undergraduate Library', abbr: 'HICKS', lat: 40.42540, lng: -86.91780 },
    { id: 18, name: 'Humanities Social Sciences and Education Library', abbr: 'HSSE', lat: 40.42600, lng: -86.91300 },
    { id: 19, name: 'Mathematical Sciences Library', abbr: 'MLIB', lat: 40.42500, lng: -86.91500 },
    
    // Student Centers & Unions
    { id: 20, name: 'Purdue Memorial Union', abbr: 'PMU', lat: 40.42480, lng: -86.91100 },
    { id: 21, name: 'Stewart Center', abbr: 'STEW', lat: 40.42600, lng: -86.91300 },
    { id: 22, name: 'Cordova Recreational Sports Center', abbr: 'CoRec', lat: 40.42920, lng: -86.92030 },
    
    // Business & Management
    { id: 23, name: 'Krannert Building', abbr: 'KRAN', lat: 40.42540, lng: -86.91860 },
    { id: 24, name: 'Rawls Hall', abbr: 'RAWL', lat: 40.42540, lng: -86.91860 },
    { id: 25, name: 'Krach Leadership Center', abbr: 'KRCH', lat: 40.42920, lng: -86.92030 },
    
    // Science Buildings
    { id: 26, name: 'Wetherill Laboratory of Chemistry', abbr: 'WTHR', lat: 40.42540, lng: -86.91540 },
    { id: 27, name: 'Brown Laboratory', abbr: 'BRNG', lat: 40.42540, lng: -86.91540 },
    { id: 28, name: 'Biochemistry Building', abbr: 'BCHM', lat: 40.42360, lng: -86.91780 },
    { id: 29, name: 'Hansen Life Sciences Research Building', abbr: 'HANS', lat: 40.42360, lng: -86.91860 },
    
    // Agriculture
    { id: 30, name: 'Smith Hall', abbr: 'SMTH', lat: 40.42410, lng: -86.91860 },
    { id: 31, name: 'Pfendler Hall', abbr: 'PFEN', lat: 40.42410, lng: -86.91860 },
    { id: 32, name: 'Agricultural Administration Building', abbr: 'AGAD', lat: 40.42410, lng: -86.91860 },
    
    // Arts & Humanities
    { id: 33, name: 'Yue-Kong Pao Hall of Visual and Performing Arts', abbr: 'PAO', lat: 40.42670, lng: -86.91380 },
    { id: 34, name: 'Patti and Rusty Rueff Hall', abbr: 'PRUF', lat: 40.42670, lng: -86.91380 },
    { id: 35, name: 'Elliott Hall of Music', abbr: 'ELLT', lat: 40.42790, lng: -86.91490 },
    { id: 36, name: 'Peirce Hall', abbr: 'PRCE', lat: 40.42540, lng: -86.91540 },
    
    // Residence Halls
    { id: 37, name: 'Earhart Hall', abbr: 'EAR', lat: 40.43180, lng: -86.92510 },
    { id: 38, name: 'First Street Towers', abbr: 'FST', lat: 40.43180, lng: -86.92510 },
    { id: 39, name: 'Hillenbrand Hall', abbr: 'HILL', lat: 40.43430, lng: -86.92510 },
    { id: 40, name: 'Harrison Hall', abbr: 'HARR', lat: 40.43430, lng: -86.92510 },
    { id: 41, name: 'Tarkington Hall', abbr: 'TARK', lat: 40.43050, lng: -86.92240 },
    { id: 42, name: 'Wiley Hall', abbr: 'WILY', lat: 40.43050, lng: -86.92160 },
    { id: 43, name: 'Windsor Halls', abbr: 'WNDS', lat: 40.42920, lng: -86.92030 },
    { id: 44, name: 'Hawkins Hall', abbr: 'HAWK', lat: 40.42540, lng: -86.91860 },
    
    // Administrative Buildings
    { id: 45, name: 'Hovde Hall', abbr: 'HOVD', lat: 40.42670, lng: -86.91460 },
    { id: 46, name: 'Schleman Hall', abbr: 'SCHL', lat: 40.42670, lng: -86.91460 },
    { id: 47, name: 'Young Hall', abbr: 'YONG', lat: 40.42540, lng: -86.91860 },
    
    // Athletic Facilities
    { id: 48, name: 'Mackey Arena', abbr: 'MACK', lat: 40.43330, lng: -86.91610 },
    { id: 49, name: 'Ross-Ade Stadium', abbr: 'ROSS', lat: 40.43560, lng: -86.92320 },
    { id: 50, name: 'Mollenkopf Athletic Center', abbr: 'MAC', lat: 40.43560, lng: -86.92320 },
    
    // Other Important Buildings
    { id: 51, name: 'Knoy Hall', abbr: 'KNOY', lat: 40.42670, lng: -86.91620 },
    { id: 52, name: 'University Hall', abbr: 'UNIV', lat: 40.42540, lng: -86.91540 },
    { id: 53, name: 'Beering Hall', abbr: 'BEER', lat: 40.42540, lng: -86.91540 },
    { id: 54, name: 'Heavilon Hall', abbr: 'HEAV', lat: 40.42540, lng: -86.91540 },
    { id: 55, name: 'Stone Hall', abbr: 'STON', lat: 40.42410, lng: -86.91860 },
    { id: 56, name: 'Pharmacy Building', abbr: 'PHAR', lat: 40.42790, lng: -86.91380 },
    { id: 57, name: 'Nursing Building', abbr: 'NURS', lat: 40.42790, lng: -86.91380 },
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

  console.log('Participant locations:', JSON.stringify(participantLocations, null, 2));

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

  console.log('First 3 building scores:', JSON.stringify(buildingScores.slice(0, 3), null, 2));

  // Sort by average distance (best locations first)
  buildingScores.sort((a, b) => a.avgDistance - b.avgDistance);

  // Return top 5 locations
  return buildingScores.slice(0, 5);
}

module.exports = router;
