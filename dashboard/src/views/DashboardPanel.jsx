import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  TrendingUp, 
  Database, 
  ArrowLeft, 
  Trash2, 
  AlertTriangle,
  Save,
  Plus,
  Shield,
  ShieldAlert,
  ListFilter,
  UserCheck
} from 'lucide-react';
import GlowToggle from '../components/GlowToggle';
import DiscordPreview from '../components/DiscordPreview';

export default function DashboardPanel({ 
  guild, 
  config, 
  welcome,
  backups,
  warnings,
  roles,
  reactionRoles,
  onSaveConfig, 
  onSaveWelcome,
  onCreateBackup, 
  onBack, 
  token,
  triggerAlert,
  setBackups,
  setWarnings,
  setReactionRoles
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [channels, setChannels] = useState([]);
  
  // Local state mappings
  const [localConfig, setLocalConfig] = useState(config);
  const [localWelcome, setLocalWelcome] = useState(welcome);
  const [backupName, setBackupName] = useState('');
  const [showRestoreModal, setShowRestoreModal] = useState(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');

  // Warn form
  const [warnUserId, setWarnUserId] = useState('');
  const [warnReason, setWarnReason] = useState('');

  // Reaction role form
  const [rrChannelId, setRrChannelId] = useState('');
  const [rrMessageId, setRrMessageId] = useState('');
  const [rrRoleId, setRrRoleId] = useState('');
  const [rrEmoji, setRrEmoji] = useState('');

  // Fetch channels list
  useEffect(() => {
    fetch(`/api/guilds/${guild.id}/channels`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) setChannels(data);
    })
    .catch(console.error);
  }, [guild.id, token]);

  // Sync props to state
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    setLocalWelcome(welcome);
  }, [welcome]);

  if (!localConfig || !localWelcome) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100%',
        backgroundColor: '#060709',
        color: '#fff',
        fontFamily: 'sans-serif'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid rgba(124, 58, 237, 0.1)',
          borderTopColor: '#7C3AED',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span>Loading server settings...</span>
      </div>
    );
  }

  const getGuildIconUrl = () => {
    if (!guild.icon) return null;
    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
  };

  // State setters
  const handleUpdateConfig = (field, value) => {
    setLocalConfig({ ...localConfig, [field]: value });
  };

  const handleUpdateLogging = (field, value) => {
    const logging = localConfig.logging || { enabled: false, enabledEvents: {} };
    setLocalConfig({
      ...localConfig,
      logging: { ...logging, [field]: value }
    });
  };

  const handleToggleLoggingEvent = (event) => {
    const logging = localConfig.logging || { enabled: false, enabledEvents: {} };
    const enabledEvents = logging.enabledEvents || {};
    setLocalConfig({
      ...localConfig,
      logging: {
        ...logging,
        enabledEvents: {
          ...enabledEvents,
          [event]: !enabledEvents[event]
        }
      }
    });
  };

  const handleUpdateAntiNuke = (field, value) => {
    const antinuke = localConfig.antinuke || { enabled: false, extraOwners: [], whitelistedUsers: {}, whitelistedRoles: {} };
    setLocalConfig({
      ...localConfig,
      antinuke: { ...antinuke, [field]: value }
    });
  };

  const handleUpdateAntiNukeSetting = (settingKey, field, value) => {
    const antinuke = localConfig.antinuke || { enabled: false, settings: {} };
    const settings = antinuke.settings || {};
    const setting = settings[settingKey] || { limit: 3, timeframe: 15000, action: 'demote' };
    
    setLocalConfig({
      ...localConfig,
      antinuke: {
        ...antinuke,
        settings: {
          ...settings,
          [settingKey]: { ...setting, [field]: value }
        }
      }
    });
  };

  const handleUpdateWelcome = (field, value) => {
    setLocalWelcome({ ...localWelcome, [field]: value });
  };

  // Actions
  const handleIssueWarning = (e) => {
    e.preventDefault();
    if (!warnUserId || !warnReason) {
      triggerAlert('error', 'Please fill in both User ID and Reason.');
      return;
    }

    fetch(`/api/guilds/${guild.id}/moderation/warn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ userId: warnUserId, reason: warnReason })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Reload warnings list
        fetch(`/api/guilds/${guild.id}/moderation/warnings`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(warningsData => {
          setWarnings(warningsData);
          triggerAlert('success', `Issued warning. User now has ${data.totalCount} warning(s).`);
          setWarnUserId('');
          setWarnReason('');
        });
      } else {
        triggerAlert('error', data.error || 'Failed to issue warning.');
      }
    })
    .catch(() => triggerAlert('error', 'Network error.'));
  };

  const handleRevokeWarning = (userId, warningId) => {
    if (!confirm('Are you sure you want to revoke this warning case?')) return;

    fetch(`/api/guilds/${guild.id}/moderation/warnings/${userId}/${warningId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setWarnings(warnings.filter(w => w.id !== warningId));
        triggerAlert('success', 'Warning case revoked.');
      } else {
        triggerAlert('error', 'Failed to delete warning.');
      }
    })
    .catch(() => triggerAlert('error', 'Failed to delete warning case.'));
  };

  const handleCreateReactionRoles = (e) => {
    e.preventDefault();
    if (!rrChannelId || !rrMessageId || !rrRoleId) {
      triggerAlert('error', 'Please select Channel, Message ID and Role.');
      return;
    }

    fetch(`/api/guilds/${guild.id}/reaction-roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        channelId: rrChannelId,
        messageId: rrMessageId,
        roleIds: [rrRoleId]
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Refresh list
        fetch(`/api/guilds/${guild.id}/reaction-roles`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(rrData => {
          setReactionRoles(rrData);
          triggerAlert('success', 'Reaction role setup published!');
          setRrMessageId('');
          setRrRoleId('');
        });
      } else {
        triggerAlert('error', data.error || 'Failed to create reaction roles.');
      }
    })
    .catch(() => triggerAlert('error', 'Network error.'));
  };

  const handleDeleteReactionRoles = (messageId) => {
    if (!confirm('Are you sure you want to delete this reaction role message mapping?')) return;

    fetch(`/api/guilds/${guild.id}/reaction-roles/${messageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setReactionRoles(reactionRoles.filter(rr => rr.messageId !== messageId));
        triggerAlert('success', 'Reaction role mapping deleted.');
      } else {
        triggerAlert('error', 'Failed to delete mapping.');
      }
    })
    .catch(() => triggerAlert('error', 'Network error.'));
  };

  const handleDeleteBackup = (backupId) => {
    if (!confirm('Are you sure you want to delete this backup?')) return;
    
    fetch(`/api/guilds/${guild.id}/backups/${backupId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setBackups(backups.filter(b => b.id !== backupId));
        triggerAlert('success', 'Backup deleted.');
      } else {
        triggerAlert('error', 'Failed to delete backup.');
      }
    })
    .catch(() => triggerAlert('error', 'Network error.'));
  };

  const handleRestoreBackup = (backupId) => {
    if (restoreConfirmText !== 'RESTORE') {
      triggerAlert('error', 'Please type RESTORE to confirm.');
      return;
    }

    setShowRestoreModal(null);
    setRestoreConfirmText('');

    fetch(`/api/guilds/${guild.id}/backups/${backupId}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        triggerAlert('success', 'Server restoration has started. Your server structure will be rebuilt momentarily.');
      } else {
        triggerAlert('error', `Restore failed: ${data.error}`);
      }
    })
    .catch(() => triggerAlert('error', 'Failed to connect to restore engine.'));
  };

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      minHeight: '100vh',
      backgroundColor: '#07080a',
      boxSizing: 'border-box'
    }}>
      {/* Sidebar Navigation */}
      <aside style={{
        width: '260px',
        borderRight: '1px solid rgba(255, 255, 255, 0.03)',
        background: 'rgba(11, 12, 16, 0.85)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        gap: '24px',
        boxSizing: 'border-box'
      }}>
        {/* Back Button */}
        <button 
          className="glow-btn-secondary" 
          onClick={onBack}
          style={{ width: '100%', padding: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Servers</span>
        </button>

        {/* Guild Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px' }}>
          {getGuildIconUrl() ? (
            <img 
              src={getGuildIconUrl()} 
              alt={guild.name} 
              style={{ width: '36px', height: '36px', borderRadius: '50%' }}
            />
          ) : (
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#7C3AED',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '14px',
              color: '#fff'
            }}>
              {guild.name.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase()}
            </div>
          )}
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', color: '#fff' }}>
              {guild.name}
            </div>
            <div style={{ fontSize: '11px', color: '#10B981' }}>Settings Panel</div>
          </div>
        </div>

        {/* Navigation Tabs List */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={() => setActiveTab('overview')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              background: activeTab === 'overview' ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
              border: activeTab === 'overview' ? '1px solid rgba(124, 58, 237, 0.2)' : '1px solid transparent',
              borderRadius: '10px',
              color: activeTab === 'overview' ? '#fff' : '#9CA3AF',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <LayoutDashboard size={16} />
            <span>Overview</span>
          </button>

          <button 
            onClick={() => setActiveTab('welcome')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              background: activeTab === 'welcome' ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
              border: activeTab === 'welcome' ? '1px solid rgba(124, 58, 237, 0.2)' : '1px solid transparent',
              borderRadius: '10px',
              color: activeTab === 'welcome' ? '#fff' : '#9CA3AF',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <MessageSquare size={16} />
            <span>Welcome Setup</span>
          </button>

          <button 
            onClick={() => setActiveTab('moderation')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              background: activeTab === 'moderation' ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
              border: activeTab === 'moderation' ? '1px solid rgba(124, 58, 237, 0.2)' : '1px solid transparent',
              borderRadius: '10px',
              color: activeTab === 'moderation' ? '#fff' : '#9CA3AF',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <ShieldAlert size={16} />
            <span>Moderation Warnings</span>
          </button>

          <button 
            onClick={() => setActiveTab('logging')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              background: activeTab === 'logging' ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
              border: activeTab === 'logging' ? '1px solid rgba(124, 58, 237, 0.2)' : '1px solid transparent',
              borderRadius: '10px',
              color: activeTab === 'logging' ? '#fff' : '#9CA3AF',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <ListFilter size={16} />
            <span>Logging Config</span>
          </button>

          <button 
            onClick={() => setActiveTab('antinuke')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              background: activeTab === 'antinuke' ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
              border: activeTab === 'antinuke' ? '1px solid rgba(124, 58, 237, 0.2)' : '1px solid transparent',
              borderRadius: '10px',
              color: activeTab === 'antinuke' ? '#fff' : '#9CA3AF',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <Shield size={16} />
            <span>Anti-Nuke Setup</span>
          </button>

          <button 
            onClick={() => setActiveTab('reactionroles')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              background: activeTab === 'reactionroles' ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
              border: activeTab === 'reactionroles' ? '1px solid rgba(124, 58, 237, 0.2)' : '1px solid transparent',
              borderRadius: '10px',
              color: activeTab === 'reactionroles' ? '#fff' : '#9CA3AF',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <UserCheck size={16} />
            <span>Reaction Roles</span>
          </button>

          <button 
            onClick={() => setActiveTab('backups')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              background: activeTab === 'backups' ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
              border: activeTab === 'backups' ? '1px solid rgba(124, 58, 237, 0.2)' : '1px solid transparent',
              borderRadius: '10px',
              color: activeTab === 'backups' ? '#fff' : '#9CA3AF',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <Database size={16} />
            <span>Server Backups</span>
          </button>
        </nav>
      </aside>

      {/* Main Panel Content */}
      <main style={{
        flex: 1,
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        maxHeight: '100vh',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}>
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>Server Overview</h2>
              <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>System configuration status and bot statistics.</p>
            </div>

            {/* Quick stats grid */}
            <div className="grid-container">
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ color: '#9CA3AF', fontSize: '13px', marginBottom: '8px' }}>Total Backups</div>
                <div style={{ fontSize: '28px', fontWeight: '700' }}>{backups.length}</div>
              </div>
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ color: '#9CA3AF', fontSize: '13px', marginBottom: '8px' }}>Moderation Warnings</div>
                <div style={{ fontSize: '28px', fontWeight: '700' }}>{warnings.length}</div>
              </div>
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ color: '#9CA3AF', fontSize: '13px', marginBottom: '8px' }}>Reaction Role Menus</div>
                <div style={{ fontSize: '28px', fontWeight: '700' }}>{reactionRoles.length}</div>
              </div>
            </div>

            {/* General Settings */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 20px', color: '#fff' }}>General Bot settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Prefix Command symbol</label>
                  <input 
                    type="text" 
                    className="glow-input"
                    value={localConfig.prefix || ''}
                    onChange={(e) => handleUpdateConfig('prefix', e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Moderator role</label>
                  <select 
                    className="glow-input"
                    value={localConfig.modRole || ''}
                    onChange={(e) => handleUpdateConfig('modRole', e.target.value)}
                  >
                    <option value="">None</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <button className="glow-btn" onClick={() => onSaveConfig(localConfig)} style={{ marginTop: '24px' }}>
                <Save size={16} />
                <span>Save General Config</span>
              </button>
            </div>
          </div>
        )}

        {/* WELCOME SETUP TAB */}
        {activeTab === 'welcome' && (
          <div className="animate-fade-in" style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>Welcome Setup</h2>
                <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>Configure greeting banners and automatic roles.</p>
              </div>

              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <GlowToggle 
                  label="Enable Greeting messages" 
                  checked={!!localWelcome.enabled} 
                  onChange={() => handleUpdateWelcome('enabled', !localWelcome.enabled)} 
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Welcome Channel</label>
                  <select 
                    className="glow-input"
                    value={localWelcome.channelId || ''}
                    onChange={(e) => handleUpdateWelcome('channelId', e.target.value)}
                  >
                    <option value="">Select a channel...</option>
                    {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Welcome Embed Title</label>
                  <input 
                    type="text" 
                    className="glow-input"
                    value={localWelcome.welcomeEmbed?.title || ''} 
                    onChange={(e) => handleUpdateWelcome('welcomeEmbed', { ...(localWelcome.welcomeEmbed || {}), title: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Welcome Message Description</label>
                  <textarea 
                    rows={4}
                    className="glow-input"
                    value={localWelcome.welcomeMessage || ''}
                    onChange={(e) => handleUpdateWelcome('welcomeMessage', e.target.value)}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Automatic Auto-Role on join</label>
                  <select 
                    className="glow-input"
                    value={localWelcome.roleIds?.[0] || ''}
                    onChange={(e) => handleUpdateWelcome('roleIds', e.target.value ? [e.target.value] : [])}
                  >
                    <option value="">None</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                <button className="glow-btn" onClick={() => onSaveWelcome(localWelcome)}>
                  <Save size={16} />
                  <span>Save Welcome Config</span>
                </button>
              </div>
            </div>

            {/* Preview Column */}
            <div style={{ width: '450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#9CA3AF', margin: 0 }}>Live Discord Embed Preview</h3>
              <DiscordPreview 
                title={localWelcome.welcomeEmbed?.title || '🎉 Welcome!'}
                description={localWelcome.welcomeMessage || 'Welcome {user} to {server}!'}
                footer="Ragnir Bot Greeting Preview"
                color="#7C3AED"
              />
            </div>
          </div>
        )}

        {/* MODERATION WARNINGS TAB */}
        {activeTab === 'moderation' && (
          <div className="animate-fade-in" style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>Warnings logs</h2>
                <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>List warnings cases and issue new punishments.</p>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Reason</th>
                      <th>Moderator</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warnings.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#4B5563', padding: '24px' }}>
                          No warnings active on this server.
                        </td>
                      </tr>
                    ) : (
                      warnings.map(w => (
                        <tr key={w.id}>
                          <td><code>{w.userId}</code></td>
                          <td>{w.reason}</td>
                          <td><code>{w.moderatorId}</code></td>
                          <td>{new Date(w.timestamp).toLocaleDateString()}</td>
                          <td>
                            <button 
                              onClick={() => handleRevokeWarning(w.userId, w.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#EF4444',
                                cursor: 'pointer',
                                fontWeight: '600'
                              }}
                            >
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Issue Warning Card */}
            <div style={{ width: '360px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 20px', color: '#fff' }}>Issue Warning</h3>
                <form onSubmit={handleIssueWarning} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Target User ID</label>
                    <input 
                      type="text" 
                      className="glow-input"
                      placeholder="e.g., 1508399186364858508"
                      value={warnUserId}
                      onChange={(e) => setWarnUserId(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Reason</label>
                    <textarea 
                      rows={3}
                      className="glow-input"
                      placeholder="Reason for warning..."
                      value={warnReason}
                      onChange={(e) => setWarnReason(e.target.value)}
                      style={{ resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </div>
                  <button type="submit" className="glow-btn" style={{ width: '100%' }}>
                    <span>Issue Warn</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* LOGGING CONFIG TAB */}
        {activeTab === 'logging' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>Logging configuration</h2>
              <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>Configure bot audit logs and toggle event filters.</p>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '700px' }}>
              <GlowToggle 
                label="Enable Audit Logging" 
                checked={!!localConfig.logging?.enabled} 
                onChange={() => handleUpdateLogging('enabled', !localConfig.logging?.enabled)} 
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '350px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Logging Output Channel</label>
                <select 
                  className="glow-input"
                  value={localConfig.logging?.channelId || ''}
                  onChange={(e) => handleUpdateLogging('channelId', e.target.value)}
                >
                  <option value="">Select a text channel...</option>
                  {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </select>
              </div>

              {/* Event check list */}
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: '0 0 12px' }}>Event Log triggers</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <GlowToggle 
                    label="Message Edits" 
                    checked={!!localConfig.logging?.enabledEvents?.messageUpdate} 
                    onChange={() => handleToggleLoggingEvent('messageUpdate')} 
                  />
                  <GlowToggle 
                    label="Message Deletions" 
                    checked={!!localConfig.logging?.enabledEvents?.messageDelete} 
                    onChange={() => handleToggleLoggingEvent('messageDelete')} 
                  />
                  <GlowToggle 
                    label="Member Joins" 
                    checked={!!localConfig.logging?.enabledEvents?.guildMemberAdd} 
                    onChange={() => handleToggleLoggingEvent('guildMemberAdd')} 
                  />
                  <GlowToggle 
                    label="Member Leaves" 
                    checked={!!localConfig.logging?.enabledEvents?.guildMemberRemove} 
                    onChange={() => handleToggleLoggingEvent('guildMemberRemove')} 
                  />
                  <GlowToggle 
                    label="Role Creations" 
                    checked={!!localConfig.logging?.enabledEvents?.roleCreate} 
                    onChange={() => handleToggleLoggingEvent('roleCreate')} 
                  />
                  <GlowToggle 
                    label="Role Deletions" 
                    checked={!!localConfig.logging?.enabledEvents?.roleDelete} 
                    onChange={() => handleToggleLoggingEvent('roleDelete')} 
                  />
                </div>
              </div>

              <button className="glow-btn" onClick={() => onSaveConfig(localConfig)} style={{ marginTop: '16px', width: 'fit-content' }}>
                <Save size={16} />
                <span>Save Logging Config</span>
              </button>
            </div>
          </div>
        )}

        {/* ANTI-NUKE TAB */}
        {activeTab === 'antinuke' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>Anti-Nuke Protection Setup</h2>
              <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>Configure server security thresholds and automatic punishments.</p>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '700px' }}>
              <GlowToggle 
                label="Enable Anti-Nuke System" 
                checked={!!localConfig.antinuke?.enabled} 
                onChange={() => handleUpdateAntiNuke('enabled', !localConfig.antinuke?.enabled)} 
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '350px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Anti-Nuke Alerts Channel</label>
                <select 
                  className="glow-input"
                  value={localConfig.antinuke?.logChannelId || ''}
                  onChange={(e) => handleUpdateAntiNuke('logChannelId', e.target.value)}
                >
                  <option value="">Select a text channel...</option>
                  {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </select>
              </div>

              {/* Threshold Rules */}
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: '0 0 16px' }}>Trigger Threshold Rules</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Channel Delete Rule */}
                  <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <div style={{ fontWeight: '600', color: '#fff', fontSize: '14px', marginBottom: '4px' }}>Channel Deletion Threshold</div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Actions taken when user deletes channels quickly.</div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ width: '80px' }}>
                        <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Limit</label>
                        <input 
                          type="number" 
                          className="glow-input" 
                          value={localConfig.antinuke?.settings?.channelDelete?.limit || 3}
                          onChange={(e) => handleUpdateAntiNukeSetting('channelDelete', 'limit', Number(e.target.value))}
                          style={{ padding: '8px' }}
                        />
                      </div>
                      <div style={{ width: '120px' }}>
                        <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Timeframe (ms)</label>
                        <input 
                          type="number" 
                          className="glow-input" 
                          value={localConfig.antinuke?.settings?.channelDelete?.timeframe || 15000}
                          onChange={(e) => handleUpdateAntiNukeSetting('channelDelete', 'timeframe', Number(e.target.value))}
                          style={{ padding: '8px' }}
                        />
                      </div>
                      <div style={{ width: '110px' }}>
                        <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Action</label>
                        <select 
                          className="glow-input"
                          value={localConfig.antinuke?.settings?.channelDelete?.action || 'demote'}
                          onChange={(e) => handleUpdateAntiNukeSetting('channelDelete', 'action', e.target.value)}
                          style={{ padding: '8px' }}
                        >
                          <option value="none">None</option>
                          <option value="demote">Demote</option>
                          <option value="kick">Kick</option>
                          <option value="ban">Ban</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Member Ban Rule */}
                  <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <div style={{ fontWeight: '600', color: '#fff', fontSize: '14px', marginBottom: '4px' }}>Member Banning Threshold</div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Actions taken when user bans server members.</div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ width: '80px' }}>
                        <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Limit</label>
                        <input 
                          type="number" 
                          className="glow-input" 
                          value={localConfig.antinuke?.settings?.memberBan?.limit || 3}
                          onChange={(e) => handleUpdateAntiNukeSetting('memberBan', 'limit', Number(e.target.value))}
                          style={{ padding: '8px' }}
                        />
                      </div>
                      <div style={{ width: '120px' }}>
                        <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Timeframe (ms)</label>
                        <input 
                          type="number" 
                          className="glow-input" 
                          value={localConfig.antinuke?.settings?.memberBan?.timeframe || 15000}
                          onChange={(e) => handleUpdateAntiNukeSetting('memberBan', 'timeframe', Number(e.target.value))}
                          style={{ padding: '8px' }}
                        />
                      </div>
                      <div style={{ width: '110px' }}>
                        <label style={{ fontSize: '10px', color: '#9CA3AF' }}>Action</label>
                        <select 
                          className="glow-input"
                          value={localConfig.antinuke?.settings?.memberBan?.action || 'demote'}
                          onChange={(e) => handleUpdateAntiNukeSetting('memberBan', 'action', e.target.value)}
                          style={{ padding: '8px' }}
                        >
                          <option value="none">None</option>
                          <option value="demote">Demote</option>
                          <option value="kick">Kick</option>
                          <option value="ban">Ban</option>
                        </select>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <button className="glow-btn" onClick={() => onSaveConfig(localConfig)} style={{ marginTop: '16px', width: 'fit-content' }}>
                <Save size={16} />
                <span>Save Anti-Nuke Setup</span>
              </button>
            </div>
          </div>
        )}

        {/* REACTION ROLES TAB */}
        {activeTab === 'reactionroles' && (
          <div className="animate-fade-in" style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>Reaction Roles setups</h2>
                <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>List role assignment messages and bind new roles.</p>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Message ID</th>
                      <th>Channel ID</th>
                      <th>Roles Count</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reactionRoles.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: '#4B5563', padding: '24px' }}>
                          No reaction role menus active on this server.
                        </td>
                      </tr>
                    ) : (
                      reactionRoles.map(rr => (
                        <tr key={rr.messageId}>
                          <td><code>{rr.messageId}</code></td>
                          <td><code>{rr.channelId}</code></td>
                          <td>{rr.roles?.length || Object.keys(rr.roles || {}).length} role(s)</td>
                          <td>
                            <button 
                              onClick={() => handleDeleteReactionRoles(rr.messageId)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#EF4444',
                                cursor: 'pointer',
                                fontWeight: '600'
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Create Reaction Role Card */}
            <div style={{ width: '360px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 20px', color: '#fff' }}>Bind Reaction Role</h3>
                <form onSubmit={handleCreateReactionRoles} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Text Channel</label>
                    <select 
                      className="glow-input"
                      value={rrChannelId}
                      onChange={(e) => setRrChannelId(e.target.value)}
                    >
                      <option value="">Select text channel...</option>
                      {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Target Message ID</label>
                    <input 
                      type="text" 
                      className="glow-input"
                      placeholder="e.g., 1530897321871671336"
                      value={rrMessageId}
                      onChange={(e) => setRrMessageId(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Assign Role</label>
                    <select 
                      className="glow-input"
                      value={rrRoleId}
                      onChange={(e) => setRrRoleId(e.target.value)}
                    >
                      <option value="">Select role...</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>

                  <button type="submit" className="glow-btn" style={{ width: '100%', marginTop: '8px' }}>
                    <span>Publish Setup</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* BACKUPS TAB */}
        {activeTab === 'backups' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>Server Backups & Recovery</h2>
              <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>Create structure snapshots and execute disaster recovery.</p>
            </div>

            {/* Trigger Backup Form */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Backup Snapshot Name</label>
                <input 
                  type="text" 
                  className="glow-input"
                  placeholder="e.g., Weekly Backup, Rollback Baseline"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                />
              </div>
              <button 
                className="glow-btn" 
                onClick={() => {
                  onCreateBackup(backupName);
                  setBackupName('');
                }}
                style={{ padding: '12px 24px' }}
              >
                <Plus size={16} />
                <span>Create Snapshot</span>
              </button>
            </div>

            {/* Backups List */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 16px', color: '#fff' }}>Saved Backups List</h3>
              
              {backups.length === 0 ? (
                <div style={{ color: '#4B5563', padding: '16px 0', textAlign: 'center', fontSize: '14px' }}>
                  No snapshots saved yet. Click the button above to create one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {backups.map(b => (
                    <div 
                      key={b.id} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.03)',
                        background: 'rgba(255,255,255,0.01)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '600', color: '#fff' }}>{b.backup_name}</span>
                          <code style={{ fontSize: '11px', color: '#7C3AED', background: 'rgba(124,58,237,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            {b.id}
                          </code>
                        </div>
                        <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                          Created: {new Date(b.created_at).toLocaleString()}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          className="glow-btn-danger" 
                          onClick={() => setShowRestoreModal(b.id)}
                          style={{ padding: '8px 16px', fontSize: '12px' }}
                        >
                          Restore
                        </button>
                        <button 
                          onClick={() => handleDeleteBackup(b.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#9CA3AF',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* CATASTROPHIC RESTORE WARNING MODAL */}
      {showRestoreModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(6, 7, 9, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '24px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '500px',
            width: '100%',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#EF4444' }}>
              <AlertTriangle size={32} />
              <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>CATASTROPHIC RESTORE WARNING</h3>
            </div>

            <p style={{ fontSize: '14px', color: '#9CA3AF', lineHeight: '1.6', margin: 0 }}>
              You are about to restore server structure from backup <strong>{showRestoreModal}</strong>.<br/><br/>
              <strong>CRITICAL ACTIONS PERFORMED:</strong><br/>
              • All existing roles will be <strong>DELETED</strong>.<br/>
              • All categories and text/voice channels will be <strong>DELETED</strong>.<br/>
              • The server channels layout will be rebuilt to match the snapshot.<br/><br/>
              <em>This cannot be undone. To proceed, please type <strong>RESTORE</strong> below.</em>
            </p>

            <input 
              type="text" 
              className="glow-input"
              placeholder="Type RESTORE to confirm"
              value={restoreConfirmText}
              onChange={(e) => setRestoreConfirmText(e.target.value)}
              style={{ border: '1px solid rgba(239,68,68,0.3)', textAlign: 'center', fontWeight: 'bold' }}
            />

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="glow-btn-secondary"
                onClick={() => {
                  setShowRestoreModal(null);
                  setRestoreConfirmText('');
                }}
              >
                Cancel
              </button>
              <button 
                className="glow-btn-danger"
                disabled={restoreConfirmText !== 'RESTORE'}
                onClick={() => handleRestoreBackup(showRestoreModal)}
                style={{ opacity: restoreConfirmText === 'RESTORE' ? 1 : 0.5 }}
              >
                Execute Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
