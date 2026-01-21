/**
 * Migration script to convert existing lat/lng coordinates to GeoJSON format
 * Run this once after updating the models to GeoJSON format
 * 
 * Usage: node scripts/migrateToGeoJSON.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meethere';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Define schemas without the GeoJSON validation for migration
const meetingSchema = new mongoose.Schema({}, { strict: false });
const participantSchema = new mongoose.Schema({}, { strict: false });

const Meeting = mongoose.model('Meeting', meetingSchema);
const Participant = mongoose.model('Participant', participantSchema);

/**
 * Convert lat/lng to GeoJSON Point
 */
function toGeoJSON(lat, lng) {
  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    return null;
  }
  return {
    type: 'Point',
    coordinates: [lng, lat], // GeoJSON uses [longitude, latitude]
  };
}

async function migrateMeetings() {
  console.log('\n📦 Migrating meetings...');
  
  const meetings = await Meeting.find({});
  let migratedCount = 0;
  let skippedCount = 0;
  
  for (const meeting of meetings) {
    let needsUpdate = false;
    const updateData = {};
    
    // Migrate creatorLocation
    if (meeting.creatorLocation?.coordinates && !meeting.creatorLocation?.location) {
      updateData['creatorLocation.location'] = toGeoJSON(
        meeting.creatorLocation.coordinates.lat,
        meeting.creatorLocation.coordinates.lng
      );
      // Remove old coordinates field
      updateData['$unset'] = { ...updateData['$unset'], 'creatorLocation.coordinates': 1 };
      needsUpdate = true;
    }
    
    // Migrate locationConstraint.center
    if (meeting.locationConstraint?.center?.lat !== undefined && 
        !meeting.locationConstraint?.center?.coordinates) {
      const center = meeting.locationConstraint.center;
      updateData['locationConstraint.center'] = toGeoJSON(center.lat, center.lng);
      
      // Convert radius from miles to meters if needed (assume old values were in miles)
      if (meeting.locationConstraint.radius && meeting.locationConstraint.radius < 100) {
        updateData['locationConstraint.radius'] = meeting.locationConstraint.radius * 1609.34;
      }
      needsUpdate = true;
    }
    
    // Migrate optimalLocation
    if (meeting.optimalLocation?.coordinates && !meeting.optimalLocation?.location) {
      updateData['optimalLocation.location'] = toGeoJSON(
        meeting.optimalLocation.coordinates.lat,
        meeting.optimalLocation.coordinates.lng
      );
      updateData['$unset'] = { ...updateData['$unset'], 'optimalLocation.coordinates': 1 };
      needsUpdate = true;
    }
    
    // Migrate optimalLocations array
    if (meeting.optimalLocations && meeting.optimalLocations.length > 0) {
      const firstLoc = meeting.optimalLocations[0];
      if (firstLoc.lat !== undefined && !firstLoc.location) {
        const migratedLocations = meeting.optimalLocations.map(loc => ({
          id: loc.id,
          name: loc.name,
          abbr: loc.abbr,
          location: toGeoJSON(loc.lat, loc.lng),
          address: loc.address,
          avgDistance: loc.avgDistance,
          maxDistance: loc.maxDistance,
          totalDistance: loc.totalDistance,
          fairnessScore: loc.fairnessScore,
          types: loc.types,
        }));
        updateData['optimalLocations'] = migratedLocations;
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      // Handle $unset separately
      const unsetData = updateData['$unset'];
      delete updateData['$unset'];
      
      const updateQuery = { $set: updateData };
      if (unsetData && Object.keys(unsetData).length > 0) {
        updateQuery['$unset'] = unsetData;
      }
      
      await Meeting.updateOne({ _id: meeting._id }, updateQuery);
      migratedCount++;
      console.log(`  ✅ Migrated meeting: ${meeting.shareLink}`);
    } else {
      skippedCount++;
    }
  }
  
  console.log(`📦 Meetings: ${migratedCount} migrated, ${skippedCount} already up to date`);
}

async function migrateParticipants() {
  console.log('\n👥 Migrating participants...');
  
  const participants = await Participant.find({});
  let migratedCount = 0;
  let skippedCount = 0;
  
  for (const participant of participants) {
    // Check if needs migration (has coordinates but no location.location)
    if (participant.location?.coordinates && !participant.location?.location) {
      const updateData = {
        'location.location': toGeoJSON(
          participant.location.coordinates.lat,
          participant.location.coordinates.lng
        ),
      };
      
      await Participant.updateOne(
        { _id: participant._id },
        { 
          $set: updateData,
          $unset: { 'location.coordinates': 1 }
        }
      );
      migratedCount++;
      console.log(`  ✅ Migrated participant: ${participant.name}`);
    } else {
      skippedCount++;
    }
  }
  
  console.log(`👥 Participants: ${migratedCount} migrated, ${skippedCount} already up to date`);
}

async function createIndexes() {
  console.log('\n📇 Creating geospatial indexes...');
  
  try {
    // Note: These will be created automatically by mongoose when the models load
    // But we can create them explicitly here if needed
    await Meeting.collection.createIndex({ 'locationConstraint.center': '2dsphere' });
    await Meeting.collection.createIndex({ 'creatorLocation.location': '2dsphere' });
    await Participant.collection.createIndex({ 'location.location': '2dsphere' });
    console.log('  ✅ Geospatial indexes created');
  } catch (error) {
    if (error.code === 85) {
      console.log('  ℹ️ Indexes already exist');
    } else {
      console.error('  ⚠️ Error creating indexes:', error.message);
    }
  }
}

async function runMigration() {
  console.log('🚀 Starting GeoJSON migration...\n');
  
  await connectDB();
  
  await migrateMeetings();
  await migrateParticipants();
  await createIndexes();
  
  console.log('\n✅ Migration complete!');
  
  await mongoose.disconnect();
  console.log('👋 Disconnected from MongoDB');
  process.exit(0);
}

runMigration().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
