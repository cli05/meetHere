# MongoDB Setup Guide for meetHere

## MongoDB Integration Status
✅ Your codebase is **already configured** for MongoDB! 

The project uses:
- Mongoose for MongoDB object modeling
- Connection string in `.env` file
- User, Meeting, and Participant schemas already defined

## Setup Steps

### 1. Install MongoDB on macOS

Choose one of these methods:

#### Option A: Using Homebrew (Recommended)
```bash
# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community

# Verify it's running
brew services list | grep mongodb
```

#### Option B: Using MongoDB Atlas (Cloud Database - No Installation)
1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for a free account
3. Create a free cluster (M0)
4. Get your connection string
5. Update your `.env` file with the Atlas connection string:
   ```
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/meethere?retryWrites=true&w=majority
   ```

### 2. Verify MongoDB Connection

After installing MongoDB locally, check if it's running:
```bash
# Check if MongoDB is running
brew services list | grep mongodb

# Or check the process
ps aux | grep mongod
```

### 3. Configure Environment Variables

Your `.env` file has been created in the `server` folder with these settings:
```
MONGODB_URI=mongodb://localhost:27017/meethere
PORT=5000
JWT_SECRET=your_jwt_secret_key_change_in_production
```

**Important:** Change `JWT_SECRET` to a random string for security!

### 4. Install Server Dependencies

```bash
cd server
npm install
```

This installs all required packages including:
- `mongoose` - MongoDB ODM
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT authentication
- `express` - Web framework
- `cors` - Cross-origin support

### 5. Start the Application

```bash
# Terminal 1: Start the backend
cd server
npm run dev

# Terminal 2: Start the frontend
cd client
npm start
```

### 6. Verify MongoDB Connection

When you start the server, you should see:
```
✅ MongoDB connected successfully
🚀 Server running on port 5000
```

## MongoDB Database Structure

Your database will have these collections:

### `users`
- name
- email (unique)
- password (hashed)
- meetings (array of meeting IDs)
- createdAt, updatedAt

### `meetings`
- name
- description
- dateRange (startDate, endDate)
- timeSlots
- participants (array of participant IDs)
- optimalLocation
- optimalTime
- createdBy (user ID)
- shareLink (unique)
- createdAt, updatedAt

### `participants`
- meetingId (reference to meeting)
- name
- availability (array of time slots)
- location (building info and coordinates)
- submittedAt
- createdAt, updatedAt

## Useful MongoDB Commands

```bash
# Connect to MongoDB shell
mongosh

# Show all databases
show dbs

# Use the meethere database
use meethere

# Show all collections
show collections

# View all users
db.users.find()

# View all meetings
db.meetings.find()

# Clear all data (be careful!)
db.users.deleteMany({})
db.meetings.deleteMany({})
db.participants.deleteMany({})

# Exit MongoDB shell
exit
```

## Troubleshooting

### MongoDB won't start
```bash
# Check if port 27017 is in use
lsof -i :27017

# Restart MongoDB
brew services restart mongodb-community
```

### Connection refused error
- Make sure MongoDB is running: `brew services list`
- Check the connection string in `.env`
- Verify MongoDB is listening on port 27017

### Can't connect to MongoDB Atlas
- Check your IP whitelist in Atlas dashboard
- Verify username/password in connection string
- Make sure connection string is properly formatted

## Next Steps

1. Install MongoDB using one of the methods above
2. Start MongoDB service
3. Run `npm install` in the server directory
4. Start the server and verify the MongoDB connection
5. Test user registration and login

Your application is ready to use MongoDB! 🚀
