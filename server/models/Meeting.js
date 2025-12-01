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
  dateRange: {
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
  },
  timeSlots: [{
    day: String,
    startTime: String,
    endTime: String,
  }],
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
    type: String,
    required: true,
  },
  shareLink: {
    type: String,
    unique: true,
    required: true,
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
