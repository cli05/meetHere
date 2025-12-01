import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import LandingPage from './components/LandingPage';
import MeetingCreator from './components/MeetingCreator';
import MeetingView from './components/MeetingView';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/create" element={<MeetingCreator />} />
          <Route path="/meeting/:id" element={<MeetingView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
