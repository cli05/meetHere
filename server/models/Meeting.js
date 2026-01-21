const mongoose = require('mongoose');

// GeoJSON Point schema (reusable)
const pointSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point',
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true,
  }
}, { _id: false });

const meetingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  // Available days that participants can select
  availableDays: [{
    type: Date,
    required: true,
  }],
  // Time range for each day
  timeRange: {
    startTime: {
      type: String, // e.g., "09:00"
      required: true,
    },
    endTime: {
      type: String, // e.g., "17:00"
      required: true,
    },
  },
  timezone: {
    type: String,
    default: 'America/New_York',
  },
  // Optional location constraint
  locationConstraint: {
    enabled: {
      type: Boolean,
      default: false,
    },
    center: pointSchema, // GeoJSON Point
    radius: {
      type: Number, // in meters
      default: 6437, // ~4 miles in meters
    },
    address: String,
  },
  // Creator's starting location
  creatorLocation: {
    buildingName: String,
    buildingAbbr: String,
    location: pointSchema, // GeoJSON Point
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant',
  }],
  optimalLocation: {
    buildingName: String,
    buildingAbbr: String,
    location: pointSchema, // GeoJSON Point
  },
  // Cached optimal locations from Google Places API
  optimalLocations: [{
    id: String,
    name: String,
    abbr: String,
    location: pointSchema, // GeoJSON Point
    address: String,
    avgDistance: Number,
    maxDistance: Number,
    totalDistance: Number,
    fairnessScore: Number,
    types: [String],
  }],
  // Track when locations were last calculated
  locationsCalculatedAt: {
    type: Date,
    default: null,
  },
  // Track participant count when locations were calculated
  locationsParticipantCount: {
    type: Number,
    default: 0,
  },
  optimalTime: {
    slots: [{
      dayIndex: Number,
      startTimeIndex: Number,
      endTimeIndex: Number,
      participantCount: Number,
      everyoneAvailable: Boolean,
    }],
    everyoneAvailable: Boolean,
    message: String,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  shareLink: {
    type: String,
    unique: true,
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'expired'],
    default: 'active',
  },
}, {
  timestamps: true,
});

// Add geospatial indexes
meetingSchema.index({ 'locationConstraint.center': '2dsphere' });
meetingSchema.index({ 'creatorLocation.location': '2dsphere' });

// Generate unique share link before saving
meetingSchema.pre('save', function(next) {
  if (!this.shareLink) {
    this.shareLink = generateShareLink();
  }
  next();
});

// Method to check if meeting has expired
meetingSchema.methods.isExpired = function() {
  if (!this.availableDays || this.availableDays.length === 0) {
    return false;
  }

  // Find the latest date from availableDays
  const latestDate = new Date(Math.max(...this.availableDays.map(d => new Date(d))));

  // Parse the end time (e.g., "21:00")
  const [endHour, endMinute] = this.timeRange.endTime.split(':').map(Number);

  // Set the expiration datetime to the latest date + end time
  const expirationDateTime = new Date(latestDate);
  expirationDateTime.setHours(endHour, endMinute, 0, 0);

  // Compare with current time
  const now = new Date();
  return now > expirationDateTime;
};

// Method to update status to expired if needed
meetingSchema.methods.checkAndUpdateExpiration = async function() {
  if (this.status === 'active' && this.isExpired()) {
    this.status = 'expired';
    await this.save();
    return true;
  }
  return false;
};

function generateShareLink() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

module.exports = mongoose.model('Meeting', meetingSchema);
