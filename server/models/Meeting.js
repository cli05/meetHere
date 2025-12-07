const mongoose = require('mongoose');

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
    center: {
      lat: Number,
      lng: Number,
    },
    radius: {
      type: Number, // in miles
      default: 4,
    },
    address: String,
  },
  // Creator's starting location
  creatorLocation: {
    buildingName: String,
    buildingAbbr: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant',
  }],
  optimalLocation: {
    buildingName: String,
    buildingAbbr: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  optimalTime: {
    date: Date,
    startTime: String,
    endTime: String,
    participantCount: Number,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  shareLink: {
    type: String,
    unique: true,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active',
  },
}, {
  timestamps: true,
});

// Generate unique share link before saving
meetingSchema.pre('save', function(next) {
  if (!this.shareLink) {
    this.shareLink = generateShareLink();
  }
  next();
});

function generateShareLink() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

module.exports = mongoose.model('Meeting', meetingSchema);
