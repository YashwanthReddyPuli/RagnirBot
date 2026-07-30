import React, { useState } from 'react';

export default function Login() {
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    fetch('/api/auth/config')
      .then(res => res.json())
      .then(config => {
        if (!config.clientId || !config.redirectUri) {
          alert('Auth configuration is missing on the server. Please check your .env variables.');
          setLoading(false);
          return;
        }

        const authorizeUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&response_type=code&scope=identify%20guilds`;
        window.location.href = authorizeUrl;
      })
      .catch(err => {
        console.error(err);
        alert('Failed to connect to the bot server.');
        setLoading(false);
      });
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative'
    }}>
      {/* Background glowing gradients */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, rgba(217, 70, 239, 0.05) 50%, rgba(0,0,0,0) 100%)',
        borderRadius: '50%',
        filter: 'blur(40px)',
        zIndex: 0
      }} />

      <div className="glass-panel animate-fade-in" style={{
        padding: '48px 32px',
        maxWidth: '450px',
        width: '100%',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        {/* Logo/Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, #7C3AED, #D946EF)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '36px',
          fontWeight: 'bold',
          color: '#ffffff',
          margin: '0 auto 24px',
          boxShadow: '0 0 24px rgba(124, 58, 237, 0.4)'
        }}>
          R
        </div>

        {/* Brand name */}
        <h1 style={{
          fontSize: '32px',
          margin: '0 0 8px',
          fontWeight: '800',
          letterSpacing: '1px',
          background: 'linear-gradient(to right, #ffffff, #E5E7EB)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          RAGNIRBOT
        </h1>
        <p style={{
          fontSize: '11px',
          color: '#7C3AED',
          fontWeight: '700',
          letterSpacing: '2px',
          margin: '0 0 24px',
          textTransform: 'uppercase'
        }}>
          ALL-IN-ONE DISCORD ASSISTANT
        </p>

        {/* Welcome paragraph */}
        <p style={{
          fontSize: '14px',
          color: '#9CA3AF',
          lineHeight: '1.6',
          margin: '0 0 32px'
        }}>
          Authorize with your Discord account to manage server configurations, edit welcome layouts, and trigger disaster recovery backups.
        </p>

        {/* Login Action Button */}
        <button
          className="glow-btn"
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            justifyContent: 'center',
            fontSize: '16px',
            padding: '14px',
            borderRadius: '10px'
          }}
        >
          {loading ? 'Connecting...' : (
            <>
              <svg width="20" height="20" viewBox="0 0 127.14 96.36" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.9-.65,1.76-1.34,2.58-2a74.11,74.11,0,0,0,72.9,0c.82.71,1.68,1.4,2.58,2a68.69,68.69,0,0,1-10.5,5A77.7,77.7,0,0,0,101.8,96.36a105.73,105.73,0,0,0,31-18.83C130.1,50.22,124.23,27.53,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"/>
              </svg>
              <span>Connect with Discord</span>
            </>
          )}
        </button>

        {/* Footer info */}
        <div style={{
          marginTop: '32px',
          fontSize: '11px',
          color: '#4B5563',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <span>Secure OAuth2 Session</span>
          <span>•</span>
          <span>Stateless JWT</span>
        </div>
      </div>
    </div>
  );
}
