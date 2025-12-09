const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // null for anonymous participants (via share link)
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  availability: [{
    dayIndex: Number,
    timeIndex: Number,
  }],
  location: {
    buildingName: String,
    buildingAbbr: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  notes: {
    type: String,
    default: '',
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Participant', participantSchema);
