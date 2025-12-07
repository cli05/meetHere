import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LandingPage.css';

const LandingPage = () => {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="landing-page">
      <nav className="navbar">
        <div className="container">
          <div className="nav-content">
            <h1 className="logo">
              <span className="logo-meet">meet</span>
              <span className="logo-here">Here</span>
            </h1>
            <div className="nav-links">
              {loading ? (
                <span style={{ color: '#888' }}>Loading...</span>
              ) : user ? (
                <>
                  <Link to="/dashboard" className="btn btn-secondary" style={{ marginRight: '12px' }}>
                    Dashboard
                  </Link>
                  <button onClick={handleLogout} className="btn btn-primary">
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/signin" className="btn btn-secondary" style={{ marginRight: '12px' }}>Sign In</Link>
                  <Link to="/signup" className="btn btn-primary">Get Started</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <span>🚂 BOILER UP</span>
            </div>
            <h1 className="hero-title">
              Find the Perfect Time<br />
              <span className="highlight">& Place to Meet</span>
            </h1>
            <p className="hero-subtitle">
              Streamline group coordination for the Purdue community.<br />
              No more endless group chats. No more inconvenient locations.
            </p>
            <div className="hero-buttons">
              <Link to="/signup" className="btn btn-primary btn-large">
                Get Started
              </Link>
              <a href="#features" className="btn btn-secondary btn-large">
                Learn More
              </a>
            </div>
          </div>
          
          <div className="hero-visual">
            <div className="visual-card">
              <div className="card-header">
                <div className="card-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div className="card-content">
                <div className="sample-grid">
                  {[...Array(5)].map((_, row) => (
                    <div key={row} className="grid-row">
                      {[...Array(7)].map((_, col) => (
                        <div 
                          key={col} 
                          className={`grid-cell ${Math.random() > 0.5 ? 'filled' : ''}`}
                          style={{
                            opacity: Math.random() > 0.5 ? Math.random() * 0.5 + 0.5 : 0.2
                          }}
                        ></div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features">
        <div className="container">
          <h2 className="section-title">Built for Boilermakers</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📅</div>
              <h3>Smart Scheduling</h3>
              <p>
                When2meet-style availability grid with enhanced UX.
                Drag to select on desktop, tap-to-paint on mobile.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📍</div>
              <h3>Location Triangulation</h3>
              <p>
                Google Maps integration finds the optimal campus building
                based on where everyone is coming from.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Lightning Fast</h3>
              <p>
                Built with the MERN stack for instant updates
                and seamless real-time collaboration.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Mobile First</h3>
              <p>
                Fully responsive design that works perfectly
                on any device. Touch-optimized for on-the-go scheduling.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Create Meeting</h3>
              <p>Set up your meeting with a name and date range</p>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Share Link</h3>
              <p>Invite participants with a unique meeting link</p>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Mark Availability</h3>
              <p>Everyone marks when they're free and where they're coming from</p>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">4</div>
              <h3>Get Results</h3>
              <p>See the best meeting time and fairest campus location</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Coordinate Your Team?</h2>
            <p>Join Purdue students simplifying group meetings</p>
            <Link to="/signup" className="btn btn-primary btn-large">
              Create Your First Meeting
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <h3>meetHere</h3>
              <p>Built by Boilermakers, for Boilermakers</p>
            </div>
            <div className="footer-links">
              <div className="footer-section">
                <h4>Product</h4>
                <a href="#features">Features</a>
                <a href="#how-it-works">How It Works</a>
                <Link to="/signup">Get Started</Link>
              </div>
              <div className="footer-section">
                <h4>About</h4>
                <a href="https://purdue.edu" target="_blank" rel="noopener noreferrer">Purdue University</a>
                <a href="#contact">Contact</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 meetHere. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
