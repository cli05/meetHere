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
    location: pointSchema, // GeoJSON Point
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

// Add geospatial index
participantSchema.index({ 'location.location': '2dsphere' });

// Compound index for finding participants by meeting
participantSchema.index({ meetingId: 1, userId: 1 });

module.exports = mongoose.model('Participant', participantSchema);
