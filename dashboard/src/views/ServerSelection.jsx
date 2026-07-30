import React, { useState, useEffect } from 'react';

export default function ServerSelection({ user, guilds, onSelectGuild, onLogout }) {
  const [clientId, setClientId] = useState('');

  // Fetch client ID to build invite link dynamically
  useEffect(() => {
    fetch('/api/auth/config')
      .then(res => res.json())
      .then(config => {
        if (config.clientId) setClientId(config.clientId);
      })
      .catch(console.error);
  }, []);

  const getInviteUrl = () => {
    return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;
  };

  const getGuildIconUrl = (guild) => {
    if (!guild.icon) return null;
    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      padding: '24px',
      maxWidth: '1200px',
      width: '100%',
      margin: '0 auto',
      boxSizing: 'border-box'
    }}>
      {/* Header Profile Bar */}
      <header className="glass-panel animate-fade-in" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        marginBottom: '48px',
        border: '1px solid rgba(255, 255, 255, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user.avatar ? (
            <img 
              src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} 
              alt={user.username}
              style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          ) : (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#7C3AED',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              color: '#fff'
            }}>{user.username[0].toUpperCase()}</div>
          )}
          <div>
            <div style={{ fontWeight: '600', fontSize: '15px' }}>{user.username}</div>
            <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Developer Session</div>
          </div>
        </div>

        <button className="glow-btn-secondary" onClick={onLogout} style={{ padding: '8px 16px', fontSize: '13px' }}>
          Logout
        </button>
      </header>

      {/* Main Grid Section */}
      <main className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', margin: '0 0 8px' }}>Select Server</h2>
          <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>
            Choose a server to configure moderation, welcome greeting templates, and backups.
          </p>
        </div>

        <div className="grid-container">
          {guilds.map(guild => {
            const iconUrl = getGuildIconUrl(guild);
            return (
              <div 
                key={guild.id} 
                className="glass-panel" 
                style={{
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.04)'
                }}
              >
                {/* Guild Icon */}
                {iconUrl ? (
                  <img 
                    src={iconUrl} 
                    alt={guild.name} 
                    style={{ width: '64px', height: '64px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                ) : (
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '20px',
                    color: '#9CA3AF'
                  }}>
                    {guild.name.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase()}
                  </div>
                )}

                {/* Guild Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '16px', color: '#fff' }}>{guild.name}</div>
                  <div style={{ fontSize: '11px', color: guild.botPresent ? '#10B981' : '#9CA3AF' }}>
                    {guild.botPresent ? '🟢 Bot Connected' : '⚪ Bot Offline'}
                  </div>
                </div>

                {/* Actions */}
                {guild.botPresent ? (
                  <button 
                    className="glow-btn" 
                    onClick={() => onSelectGuild(guild.id)}
                    style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                  >
                    Configure
                  </button>
                ) : (
                  <a 
                    href={getInviteUrl()} 
                    target="_blank" 
                    rel="noreferrer"
                    className="glow-btn-secondary" 
                    style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', padding: '10px', boxSizing: 'border-box' }}
                  >
                    Invite Bot
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
