import React, { useState, useEffect } from 'react';
import Login from './views/Login';
import ServerSelection from './views/ServerSelection';
import DashboardPanel from './views/DashboardPanel';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('ragnir_jwt_token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('ragnir_user')) || null);
  const [guilds, setGuilds] = useState([]);
  const [currentGuildId, setCurrentGuildId] = useState(null);
  
  // Settings modules state
  const [guildConfig, setGuildConfig] = useState(null);
  const [welcomeConfig, setWelcomeConfig] = useState(null);
  const [backups, setBackups] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [roles, setRoles] = useState([]);
  const [reactionRoles, setReactionRoles] = useState([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  // Trigger temporary toasts
  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  // Handle OAuth2 Redirect callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      setIsLoading(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })
      .then(res => res.json())
      .then(data => {
        setIsLoading(false);
        if (data.error) {
          triggerAlert('error', `Login Failed: ${data.error}`);
        } else {
          setToken(data.token);
          setUser(data.user);
          localStorage.setItem('ragnir_jwt_token', data.token);
          localStorage.setItem('ragnir_user', JSON.stringify(data.user));
          triggerAlert('success', `Welcome back, ${data.user.username}!`);
        }
      })
      .catch(err => {
        setIsLoading(false);
        triggerAlert('error', 'Failed to communicate with auth server.');
      });
    }
  }, []);

  // Fetch guilds when token is present
  useEffect(() => {
    if (token) {
      setIsLoading(true);
      fetch('/api/user/guilds', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (res.status === 401) {
          handleLogout();
          throw new Error('Session expired');
        }
        return res.json();
      })
      .then(data => {
        setIsLoading(false);
        setGuilds(data);
      })
      .catch(err => {
        setIsLoading(false);
        console.error(err);
      });
    }
  }, [token]);

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setGuilds([]);
    setCurrentGuildId(null);
    setGuildConfig(null);
    setWelcomeConfig(null);
    setBackups([]);
    setWarnings([]);
    setRoles([]);
    setReactionRoles([]);
    localStorage.removeItem('ragnir_jwt_token');
    localStorage.removeItem('ragnir_user');
    triggerAlert('success', 'Logged out successfully.');
  };

  const handleSelectGuild = (guildId) => {
    setIsLoading(true);
    setCurrentGuildId(guildId);
    
    // Fetch all configurations in parallel
    const pConfig = fetch(`/api/guilds/${guildId}/config`, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());
    const pWelcome = fetch(`/api/guilds/${guildId}/welcome`, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());
    const pBackups = fetch(`/api/guilds/${guildId}/backups`, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());
    const pWarnings = fetch(`/api/guilds/${guildId}/moderation/cases`, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());
    const pRoles = fetch(`/api/guilds/${guildId}/roles`, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());
    const pReactionRoles = fetch(`/api/guilds/${guildId}/reaction-roles`, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());

    Promise.all([pConfig, pWelcome, pBackups, pWarnings, pRoles, pReactionRoles])
      .then(([configData, welcomeData, backupsData, warningsData, rolesData, rrData]) => {
        setGuildConfig(configData);
        setWelcomeConfig(welcomeData);
        setBackups(backupsData);
        setWarnings(warningsData);
        setRoles(rolesData);
        setReactionRoles(rrData);
        setIsLoading(false);
      })
      .catch(err => {
        setIsLoading(false);
        triggerAlert('error', 'Failed to load server settings.');
        setCurrentGuildId(null);
      });
  };

  const handleSaveConfig = (updatedConfig) => {
    setIsLoading(true);
    fetch(`/api/guilds/${currentGuildId}/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(updatedConfig)
    })
    .then(res => res.json())
    .then(data => {
      setIsLoading(false);
      if (data.success) {
        setGuildConfig(data.config);
        triggerAlert('success', 'Configuration saved successfully!');
      } else {
        triggerAlert('error', 'Failed to save configuration.');
      }
    })
    .catch(err => {
      setIsLoading(false);
      triggerAlert('error', 'Network error: could not save config.');
    });
  };

  const handleSaveWelcome = (updatedWelcome) => {
    setIsLoading(true);
    fetch(`/api/guilds/${currentGuildId}/welcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(updatedWelcome)
    })
    .then(res => res.json())
    .then(data => {
      setIsLoading(false);
      if (data.success) {
        setWelcomeConfig(updatedWelcome);
        triggerAlert('success', 'Welcome greeting settings saved!');
      } else {
        triggerAlert('error', 'Failed to save welcome settings.');
      }
    })
    .catch(() => {
      setIsLoading(false);
      triggerAlert('error', 'Failed to save welcome configuration.');
    });
  };

  const handleCreateBackup = (name) => {
    setIsLoading(true);
    fetch(`/api/guilds/${currentGuildId}/backups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        triggerAlert('error', `Backup failed: ${data.error}`);
        setIsLoading(false);
      } else {
        fetch(`/api/guilds/${currentGuildId}/backups`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(backupsData => {
          setBackups(backupsData);
          setIsLoading(false);
          triggerAlert('success', `Backup '${data.name}' created!`);
        });
      }
    })
    .catch(() => {
      setIsLoading(false);
      triggerAlert('error', 'Failed to trigger backup.');
    });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Alert Banner */}
      {alert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '12px 24px',
          borderRadius: '8px',
          border: `1px solid ${alert.type === 'success' ? '#10B981' : '#EF4444'}`,
          background: alert.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          backdropFilter: 'blur(8px)',
          color: alert.type === 'success' ? '#10B981' : '#EF4444',
          fontWeight: '600',
          fontSize: '14px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {alert.message}
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(6, 7, 9, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(124, 58, 237, 0.1)',
            borderTopColor: '#7C3AED',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}

      {/* Main View Router */}
      {!token ? (
        <Login />
      ) : !currentGuildId ? (
        <ServerSelection 
          user={user} 
          guilds={guilds} 
          onSelectGuild={handleSelectGuild} 
          onLogout={handleLogout} 
        />
      ) : (
        <DashboardPanel 
          guild={guilds.find(g => g.id === currentGuildId)} 
          config={guildConfig} 
          welcome={welcomeConfig}
          backups={backups}
          warnings={warnings}
          roles={roles}
          reactionRoles={reactionRoles}
          onSaveConfig={handleSaveConfig} 
          onSaveWelcome={handleSaveWelcome}
          onCreateBackup={handleCreateBackup}
          onBack={() => setCurrentGuildId(null)} 
          token={token}
          triggerAlert={triggerAlert}
          setBackups={setBackups}
          setWarnings={setWarnings}
          setReactionRoles={setReactionRoles}
        />
      )}
    </div>
  );
}
