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
  UserCheck,
  Zap,
  Fingerprint,
  Star
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

  // Whitelist inputs
  const [newExtraOwner, setNewExtraOwner] = useState('');
  const [newWhitelistUser, setNewWhitelistUser] = useState('');
  const [newWhitelistRole, setNewWhitelistRole] = useState('');
  const [antiNukeCategoryTab, setAntiNukeCategoryTab] = useState('channels');

  // Lockdown and Prefix inputs
  const [lockdownActive, setLockdownActive] = useState(config?.lockdownActive || false);
  const [newNoPrefixUserId, setNewNoPrefixUserId] = useState('');

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
    setLockdownActive(config?.lockdownActive || false);
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
          border: '3px solid rgba(239, 68, 68, 0.1)',
          borderTopColor: '#EF4444',
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

  const renderRuleCard = (key, title, description, hideTimeframe = false) => {
    const settings = localConfig.antinuke?.settings || {};
    const setting = settings[key] || { limit: 3, timeframe: 15000, action: 'demote' };
    return (
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }} key={key}>
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: '0 0 4px' }}>{title}</h4>
          <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{description}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {!hideTimeframe && (
            <>
              <div style={{ flex: 1, minWidth: '70px' }}>
                <label style={{ fontSize: '10px', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>Limit</label>
                <input 
                  type="number" 
                  className="glow-input" 
                  min="1"
                  max="100"
                  value={setting.limit}
                  onChange={(e) => handleUpdateAntiNukeSetting(key, 'limit', Number(e.target.value))}
                  style={{ padding: '8px' }}
                />
              </div>
              <div style={{ flex: 1.2, minWidth: '100px' }}>
                <label style={{ fontSize: '10px', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>Time (sec)</label>
                <input 
                  type="number" 
                  className="glow-input" 
                  min="1"
                  max="300"
                  value={Math.round((setting.timeframe || 15000) / 1000)}
                  onChange={(e) => handleUpdateAntiNukeSetting(key, 'timeframe', Number(e.target.value) * 1000)}
                  style={{ padding: '8px' }}
                />
              </div>
            </>
          )}
          <div style={{ flex: 1.2, minWidth: '110px' }}>
            <label style={{ fontSize: '10px', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>Action</label>
            <select 
              className="glow-input"
              value={setting.action}
              onChange={(e) => handleUpdateAntiNukeSetting(key, 'action', e.target.value)}
              style={{ padding: '8px' }}
            >
              <option value="none">Log Only</option>
              <option value="demote">Demote</option>
              <option value="kick">Kick</option>
              <option value="ban">Ban</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

  const handleAddExtraOwner = (userId) => {
    if (!userId) return;
    const extraOwners = [...(localConfig.antinuke?.extraOwners || [])];
    if (extraOwners.includes(userId)) {
      triggerAlert('error', 'User ID is already an extra owner.');
      return;
    }
    extraOwners.push(userId);
    handleUpdateAntiNuke('extraOwners', extraOwners);
    setNewExtraOwner('');
    triggerAlert('success', 'Extra Owner added (save to apply).');
  };

  const handleRemoveExtraOwner = (userId) => {
    const extraOwners = (localConfig.antinuke?.extraOwners || []).filter(id => id !== userId);
    handleUpdateAntiNuke('extraOwners', extraOwners);
    triggerAlert('success', 'Extra Owner removed (save to apply).');
  };

  const handleAddWhitelistedUser = (userId) => {
    if (!userId) return;
    const whitelistedUsers = { ...(localConfig.antinuke?.whitelistedUsers || {}) };
    whitelistedUsers[userId] = true;
    handleUpdateAntiNuke('whitelistedUsers', whitelistedUsers);
    setNewWhitelistUser('');
    triggerAlert('success', 'User added to Whitelist (save to apply).');
  };

  const handleRemoveWhitelistedUser = (userId) => {
    const whitelistedUsers = { ...(localConfig.antinuke?.whitelistedUsers || {}) };
    delete whitelistedUsers[userId];
    handleUpdateAntiNuke('whitelistedUsers', whitelistedUsers);
    triggerAlert('success', 'User removed from Whitelist (save to apply).');
  };

  const handleAddWhitelistedRole = (roleId) => {
    if (!roleId) return;
    const whitelistedRoles = { ...(localConfig.antinuke?.whitelistedRoles || {}) };
    whitelistedRoles[roleId] = true;
    handleUpdateAntiNuke('whitelistedRoles', whitelistedRoles);
    setNewWhitelistRole('');
    triggerAlert('success', 'Role added to Whitelist (save to apply).');
  };

  const handleRemoveWhitelistedRole = (roleId) => {
    const whitelistedRoles = { ...(localConfig.antinuke?.whitelistedRoles || {}) };
    delete whitelistedRoles[roleId];
    handleUpdateAntiNuke('whitelistedRoles', whitelistedRoles);
    triggerAlert('success', 'Role removed from Whitelist (save to apply).');
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

  const handleToggleLockdown = () => {
    const nextState = !lockdownActive;
    fetch(`/api/guilds/${guild.id}/lockdown`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ active: nextState })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setLockdownActive(nextState);
        triggerAlert('success', nextState ? '🚨 EMERGENCY LOCKDOWN ACTIVE: Server channels frozen!' : '🔓 Lockdown lifted: Server channels unfrozen.');
      } else {
        triggerAlert('error', `Failed to toggle lockdown: ${data.error}`);
      }
    })
    .catch(() => triggerAlert('error', 'Error communicating with lockdown engine.'));
  };

  const handleAddNoPrefixUser = (userId) => {
    if (!userId || !/^\d+$/.test(userId)) {
      triggerAlert('error', 'Please enter a valid numeric User ID.');
      return;
    }
    const currentUsers = [...(localConfig.noPrefixUsers || [])];
    if (currentUsers.includes(userId)) {
      triggerAlert('error', 'User ID is already whitelisted.');
      return;
    }
    const updatedUsers = [...currentUsers, userId];
    setLocalConfig({ ...localConfig, noPrefixUsers: updatedUsers });
    setNewNoPrefixUserId('');
    triggerAlert('success', 'User whitelisted for No Prefix (save to apply).');
  };

  const handleRemoveNoPrefixUser = (userId) => {
    const currentUsers = [...(localConfig.noPrefixUsers || [])];
    const filteredUsers = currentUsers.filter(id => id !== userId);
    setLocalConfig({ ...localConfig, noPrefixUsers: filteredUsers });
    triggerAlert('success', 'User removed from No Prefix whitelist (save to apply).');
  };

  const handleUpdateVanity = (field, value) => {
    const currentVanity = localConfig.vanity || { enabled: false, text: '', roleId: null };
    setLocalConfig({
      ...localConfig,
      vanity: {
        ...currentVanity,
        [field]: value
      }
    });
  };

  const handleUpdateAutoMod = (path, value) => {
    const currentAutoMod = localConfig.automod || { enabled: false, logChannelId: null, ignoredChannels: [], ignoredRoles: [], timeoutDuration: 600000 };
    let updated;
    if (path.includes('.')) {
      const [parent, child] = path.split('.');
      updated = {
        ...localConfig,
        automod: {
          ...currentAutoMod,
          [parent]: {
            ...(currentAutoMod[parent] || {}),
            [child]: value
          }
        }
      };
    } else {
      updated = {
        ...localConfig,
        automod: {
          ...currentAutoMod,
          [path]: value
        }
      };
    }
    setLocalConfig(updated);
  };

  const handleUpdateVerification = (path, value) => {
    const currentVerif = localConfig.verification || { enabled: false, channelId: null, roleId: null, buttonText: 'Verify', autoVerify: { enabled: false, criteria: 'none' } };
    let updated;
    if (path.includes('.')) {
      const [parent, child] = path.split('.');
      updated = {
        ...localConfig,
        verification: {
          ...currentVerif,
          [parent]: {
            ...(currentVerif[parent] || {}),
            [child]: value
          }
        }
      };
    } else {
      updated = {
        ...localConfig,
        verification: {
          ...currentVerif,
          [path]: value
        }
      };
    }
    setLocalConfig(updated);
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

  const renderSidebarItem = (tabId, label, icon) => {
    const Icon = icon;
    const isActive = activeTab === tabId;
    return (
      <button 
        key={tabId}
        onClick={() => setActiveTab(tabId)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
          padding: '10px 14px',
          background: isActive ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
          border: isActive ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid transparent',
          borderRadius: '12px',
          color: isActive ? '#fff' : '#94A3B8',
          cursor: 'pointer',
          fontWeight: '600',
          fontSize: '13px',
          textAlign: 'left',
          transition: 'all 0.2s ease',
          boxSizing: 'border-box',
          marginBottom: '2px'
        }}
      >
        <Icon size={15} style={{ color: isActive ? '#EF4444' : '#64748B' }} />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      minHeight: '100vh',
      backgroundColor: '#020617',
      boxSizing: 'border-box',
      position: 'relative'
    }}>
      {/* Liquid Background Elements */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '40%', height: '40%', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '50%', filter: 'blur(120px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '-5%', width: '30%', height: '30%', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '50%', filter: 'blur(100px)' }} />
      </div>

      {/* Sidebar Navigation */}
      <aside style={{
        width: '260px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(10, 15, 30, 0.45)',
        backdropFilter: 'blur(40px)',
        display: 'flex',
        flexDirection: 'column',
        margin: '16px',
        borderRadius: '24px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        zIndex: 1
      }}>
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '24px 16px 12px 16px' }}>
          <div style={{
            height: '36px',
            width: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(to bottom right, #EF4444, #991B1B)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <Shield size={20} style={{ color: '#fff' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff', letterSpacing: '0.5px' }}>RAGNIRBOT</span>
            <span style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(239, 68, 68, 0.8)' }}>DASHBOARD</span>
          </div>
        </div>

        {/* Guild Info */}
        <div style={{ padding: '0 16px 16px 16px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            padding: '12px', 
            background: 'rgba(255,255,255,0.02)', 
            borderRadius: '14px', 
            border: '1px solid rgba(255,255,255,0.05)' 
          }}>
            {getGuildIconUrl() ? (
              <img 
                src={getGuildIconUrl()} 
                alt={guild.name} 
                style={{ width: '32px', height: '32px', borderRadius: '50%' }}
              />
            ) : (
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '12px',
                color: '#fff'
              }}>
                {guild.name.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase()}
              </div>
            )}
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontWeight: '700', fontSize: '13px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', color: '#fff' }}>
                {guild.name}
              </div>
              <div style={{ fontSize: '10px', color: '#10B981', fontWeight: '600' }}>Active Settings</div>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="no-scrollbar" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px', 
          padding: '0 16px 16px 16px',
          flex: 1,
          overflowY: 'auto'
        }}>
          {/* CORE SECTION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {renderSidebarItem('overview', 'Overview', LayoutDashboard)}
          </div>

          {/* SECURITY */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ margin: '0 0 6px 10px', fontSize: '10px', fontWeight: '900', color: '#64748B', letterSpacing: '2px', textTransform: 'uppercase' }}>Security</p>
            {renderSidebarItem('antinuke', 'Anti-Nuke Setup', Shield)}
            {renderSidebarItem('automod', 'Auto-Moderation', Zap)}
            {renderSidebarItem('verification', 'Verification Setup', Fingerprint)}
          </div>

          {/* ENGAGEMENT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ margin: '0 0 6px 10px', fontSize: '10px', fontWeight: '900', color: '#64748B', letterSpacing: '2px', textTransform: 'uppercase' }}>Engagement</p>
            {renderSidebarItem('welcome', 'Welcome Setup', MessageSquare)}
            {renderSidebarItem('reactionroles', 'Reaction Roles', UserCheck)}
            {renderSidebarItem('vanity', 'Vanity Reward', Star)}
          </div>

          {/* UTILITY */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ margin: '0 0 6px 10px', fontSize: '10px', fontWeight: '900', color: '#64748B', letterSpacing: '2px', textTransform: 'uppercase' }}>Utility / System</p>
            {renderSidebarItem('logging', 'Logging Config', ListFilter)}
            {renderSidebarItem('moderation', 'Moderation Warnings', ShieldAlert)}
            {renderSidebarItem('backups', 'Server Backups', Database)}
            {renderSidebarItem('settings', 'Server Settings', LayoutDashboard)}
          </div>

          {/* Exit Link */}
          <button 
            className="glow-btn-secondary" 
            onClick={onBack}
            style={{ width: '100%', padding: '10px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', marginTop: 'auto' }}
          >
            <ArrowLeft size={14} />
            <span>Back to Servers</span>
          </button>
        </nav>

        {/* User Profile Widget */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(239, 68, 68, 0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ height: '32px', width: '32px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(239, 68, 68, 0.2)', overflow: 'hidden' }}>
              <UserCheck size={16} style={{ color: '#EF4444' }} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Administrator</p>
              <p style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', color: 'rgba(239, 68, 68, 0.6)', margin: 0, letterSpacing: '1.5px' }}>Active Session</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main style={{
        flex: 1,
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxHeight: '100vh',
        overflowY: 'auto',
        boxSizing: 'border-box',
        zIndex: 1
      }}>
        {/* Top Navbar */}
        <header style={{
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(255, 255, 255, 0.01)',
          backdropFilter: 'blur(30px)',
          padding: '0 32px',
          borderRadius: '32px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
          marginBottom: '12px',
          flexShrink: 0
        }}>
          {/* Search bar */}
          <div style={{ display: 'flex', alignItems: 'center', width: '320px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '16px', color: '#64748B', display: 'flex', alignItems: 'center' }}>🔍</span>
            <input 
              type="text" 
              placeholder="Query neural network..." 
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '16px',
                padding: '10px 16px 10px 42px',
                fontSize: '12px',
                fontWeight: '700',
                color: '#CBD5E1',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Right Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* Bell/Broadcasts dropdown */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                position: 'relative'
              }}>
                🔔
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  height: '8px',
                  width: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#EF4444',
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)'
                }} />
              </button>
            </div>

            <div style={{ height: '24px', width: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }} />

            {/* Profile Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                height: '36px',
                width: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                overflow: 'hidden'
              }}>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#EF4444' }}>A</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#E2E8F0' }}>Administrator</span>
                <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', color: 'rgba(239, 68, 68, 0.6)', letterSpacing: '1px', marginTop: '2px' }}>Active</span>
              </div>
            </div>
          </div>
        </header>

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

            {/* Lockdown Control Panel */}
            <div className="glass-panel" style={{ 
              padding: '24px', 
              border: lockdownActive ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255,255,255,0.04)',
              background: lockdownActive ? 'rgba(239, 68, 68, 0.02)' : 'rgba(255,255,255,0.01)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '20px'
            }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 4px', color: lockdownActive ? '#EF4444' : '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🚨 Emergency Server Lockdown</span>
                  {lockdownActive && <span className="animate-pulse" style={{ fontSize: '11px', background: '#EF4444', color: '#fff', padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>Active</span>}
                </h3>
                <p style={{ color: '#9CA3AF', fontSize: '12px', margin: 0 }}>
                  {lockdownActive 
                    ? 'All server channels are currently locked down. Members cannot send messages or add reactions.' 
                    : 'Instantly freeze writing permissions for @everyone across all text channels during an active raid.'}
                </p>
              </div>
              <button 
                onClick={handleToggleLockdown}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  border: lockdownActive ? '1px solid #10B981' : '1px solid #EF4444',
                  background: lockdownActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: lockdownActive ? '#10B981' : '#EF4444',
                  boxShadow: lockdownActive ? '0 0 15px rgba(16, 185, 129, 0.15)' : '0 0 15px rgba(239, 68, 68, 0.15)',
                  transition: 'all 0.2s ease'
                }}
              >
                {lockdownActive ? 'Lift Lockdown' : 'Trigger Lockdown'}
              </button>
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
                color="#EF4444"
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
              <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px', color: '#fff' }}>Anti-Nuke Protection Setup</h2>
              <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>Configure server security thresholds, automatic punishments, and whitelisted operators.</p>
            </div>

            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
              {/* Left Column: General Configuration & Whitelists */}
              <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* General Settings */}
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={18} style={{ color: '#EF4444' }} />
                    <span>Security Engine</span>
                  </h3>
                  
                  <GlowToggle 
                    label="Enable Anti-Nuke Protection" 
                    checked={!!localConfig.antinuke?.enabled} 
                    onChange={() => handleUpdateAntiNuke('enabled', !localConfig.antinuke?.enabled)} 
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Security Alert Log Channel</label>
                    <select 
                      className="glow-input"
                      value={localConfig.antinuke?.logChannelId || ''}
                      onChange={(e) => handleUpdateAntiNuke('logChannelId', e.target.value)}
                    >
                      <option value="">Select a channel...</option>
                      {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Whitelist: Extra Owners */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', margin: '0 0 16px' }}>Extra Owners Whitelist</h3>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <input 
                      type="text" 
                      className="glow-input" 
                      placeholder="Enter Discord User ID"
                      value={newExtraOwner}
                      onChange={(e) => setNewExtraOwner(e.target.value)}
                      style={{ padding: '10px 14px' }}
                    />
                    <button 
                      className="glow-btn"
                      onClick={() => handleAddExtraOwner(newExtraOwner)}
                      style={{ padding: '10px 20px', fontSize: '13px' }}
                    >
                      Add
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(localConfig.antinuke?.extraOwners || []).length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic' }}>No extra owners defined.</div>
                    ) : (
                      (localConfig.antinuke?.extraOwners || []).map(userId => (
                        <div key={userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                          <code style={{ fontSize: '12px', color: '#A78BFA' }}>{userId}</code>
                          <button 
                            onClick={() => handleRemoveExtraOwner(userId)}
                            style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Whitelist: Users */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', margin: '0 0 16px' }}>Whitelisted Trusted Users</h3>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <input 
                      type="text" 
                      className="glow-input" 
                      placeholder="Enter Trusted User ID"
                      value={newWhitelistUser}
                      onChange={(e) => setNewWhitelistUser(e.target.value)}
                      style={{ padding: '10px 14px' }}
                    />
                    <button 
                      className="glow-btn"
                      onClick={() => handleAddWhitelistedUser(newWhitelistUser)}
                      style={{ padding: '10px 20px', fontSize: '13px' }}
                    >
                      Add
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.keys(localConfig.antinuke?.whitelistedUsers || {}).length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic' }}>No trusted users whitelisted.</div>
                    ) : (
                      Object.keys(localConfig.antinuke?.whitelistedUsers || {}).map(userId => (
                        <div key={userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                          <code style={{ fontSize: '12px', color: '#A78BFA' }}>{userId}</code>
                          <button 
                            onClick={() => handleRemoveWhitelistedUser(userId)}
                            style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Whitelist: Roles */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', margin: '0 0 16px' }}>Whitelisted Bypass Roles</h3>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <select 
                      className="glow-input"
                      value={newWhitelistRole}
                      onChange={(e) => setNewWhitelistRole(e.target.value)}
                      style={{ padding: '10px 14px' }}
                    >
                      <option value="">Select bypass role...</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <button 
                      className="glow-btn"
                      onClick={() => handleAddWhitelistedRole(newWhitelistRole)}
                      style={{ padding: '10px 20px', fontSize: '13px' }}
                    >
                      Add
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.keys(localConfig.antinuke?.whitelistedRoles || {}).length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic' }}>No bypass roles whitelisted.</div>
                    ) : (
                      Object.keys(localConfig.antinuke?.whitelistedRoles || {}).map(roleId => {
                        const roleObj = roles.find(r => r.id === roleId);
                        return (
                          <div key={roleId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                            <span style={{ fontSize: '13px', color: roleObj?.color || '#fff', fontWeight: '500' }}>
                              {roleObj ? roleObj.name : `Role (${roleId})`}
                            </span>
                            <button 
                              onClick={() => handleRemoveWhitelistedRole(roleId)}
                              style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column: Threshold Configs */}
              <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>Protection Threshold Settings</h3>
                
                {/* Category Switcher Tabs */}
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  {['channels', 'members', 'server'].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setAntiNukeCategoryTab(cat)}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        background: antiNukeCategoryTab === cat ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                        border: antiNukeCategoryTab === cat ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid transparent',
                        color: antiNukeCategoryTab === cat ? '#fff' : '#9CA3AF',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'capitalize',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {cat === 'channels' ? 'Channels & Roles' : cat === 'members' ? 'Members & Kicks' : 'Server & Webhooks'}
                    </button>
                  ))}
                </div>

                {/* Sub Tab Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {antiNukeCategoryTab === 'channels' && (
                    <>
                      {renderRuleCard('channelCreate', 'Mass Channel Creation', 'Triggers when a member creates text/voice channels in rapid succession.')}
                      {renderRuleCard('channelDelete', 'Mass Channel Deletion', 'Triggers when channels are deleted consecutively within the timeframe.')}
                      {renderRuleCard('roleCreate', 'Mass Role Creation', 'Triggers when roles are flooded or created rapidly.')}
                      {renderRuleCard('roleDelete', 'Mass Role Deletion', 'Triggers when roles are purged or deleted consecutively.')}
                      {renderRuleCard('roleUpdate', 'Mass Role Modification', 'Triggers when role settings (hoist, permissions) are updated in bulk.')}
                    </>
                  )}

                  {antiNukeCategoryTab === 'members' && (
                    <>
                      {renderRuleCard('ban', 'Mass Member Banning', 'Protects server from rogue admins banning members in waves.')}
                      {renderRuleCard('kick', 'Mass Member Kicking', 'Protects server from rogue admins kicking members in waves.')}
                      {renderRuleCard('botAdd', 'Unauthorized Bot Additions', 'Immediately ban unapproved external bots and the inviter who brought them.', true)}
                    </>
                  )}

                  {antiNukeCategoryTab === 'server' && (
                    <>
                      {renderRuleCard('webhook', 'Webhook Flood Prevention', 'Triggers when webhooks are created, modified or deleted in bulk.')}
                      {renderRuleCard('serverUpdate', 'Guild Settings Updates', 'Triggers when general server details (name, region, vanity URL) are changed repeatedly.')}
                      {renderRuleCard('emojiCreate', 'Mass Emoji Creation', 'Triggers when custom server emojis are created in bulk.')}
                      {renderRuleCard('emojiDelete', 'Mass Emoji Deletion', 'Triggers when custom server emojis are deleted in bulk.')}
                      {renderRuleCard('emojiUpdate', 'Mass Emoji Modification', 'Triggers when emojis/stickers are modified in bulk.')}
                    </>
                  )}
                </div>

                <button 
                  className="glow-btn" 
                  onClick={() => onSaveConfig(localConfig)} 
                  style={{ width: '100%', padding: '14px', fontSize: '14px', marginTop: '12px' }}
                >
                  <Save size={16} />
                  <span>Save Anti-Nuke Configurations</span>
                </button>

              </div>
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
                          <code style={{ fontSize: '11px', color: '#EF4444', background: 'rgba(124,58,237,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
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

        {/* VANITY STATUS REWARD TAB */}
        {activeTab === 'vanity' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>Custom Status Vanity Reward</h2>
              <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>Automatically reward members who place your server invite or custom text in their status.</p>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
              <GlowToggle 
                label="Enable Status reward" 
                checked={!!localConfig.vanity?.enabled} 
                onChange={() => handleUpdateVanity('enabled', !localConfig.vanity?.enabled)} 
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Status Keyword / Invite Link</label>
                <input 
                  type="text" 
                  className="glow-input"
                  placeholder="e.g., discord.gg/ragnir"
                  value={localConfig.vanity?.text || ''} 
                  onChange={(e) => handleUpdateVanity('text', e.target.value)}
                />
                <span style={{ fontSize: '11px', color: '#6B7280' }}>The matching is case-insensitive. If this phrase is found in user custom status text, they get rewarded.</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Reward Role</label>
                <select 
                  className="glow-input"
                  value={localConfig.vanity?.roleId || ''}
                  onChange={(e) => handleUpdateVanity('roleId', e.target.value || null)}
                >
                  <option value="">Select a role to assign...</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <button className="glow-btn" onClick={() => onSaveConfig(localConfig)} style={{ marginTop: '8px' }}>
                <Save size={16} />
                <span>Save Vanity Configuration</span>
              </button>
            </div>
          </div>
        )}

        {/* SERVER SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="animate-fade-in" style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>Server Settings</h2>
                <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>Configure prefixes, administrators, and prefixless whitelists.</p>
              </div>

              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Server-wide Command Prefix</label>
                  <input 
                    type="text" 
                    className="glow-input"
                    value={localConfig.prefix || ';'}
                    onChange={(e) => handleUpdateConfig('prefix', e.target.value)}
                    maxLength={5}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Moderator Role</label>
                  <select 
                    className="glow-input"
                    value={localConfig.modRole || ''}
                    onChange={(e) => handleUpdateConfig('modRole', e.target.value || null)}
                  >
                    <option value="">None</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Administrator Role</label>
                  <select 
                    className="glow-input"
                    value={localConfig.adminRole || ''}
                    onChange={(e) => handleUpdateConfig('adminRole', e.target.value || null)}
                  >
                    <option value="">None</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                <button className="glow-btn" onClick={() => onSaveConfig(localConfig)}>
                  <Save size={16} />
                  <span>Save Settings Config</span>
                </button>
              </div>
            </div>

            {/* No Prefix Whitelist Panel */}
            <div style={{ width: '360px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 16px', color: '#fff' }}>No-Prefix Users Whitelist</h3>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <input 
                    type="text" 
                    className="glow-input" 
                    placeholder="Enter User ID"
                    value={newNoPrefixUserId}
                    onChange={(e) => setNewNoPrefixUserId(e.target.value)}
                    style={{ padding: '10px 14px' }}
                  />
                  <button 
                    className="glow-btn"
                    onClick={() => handleAddNoPrefixUser(newNoPrefixUserId)}
                    style={{ padding: '10px 20px', fontSize: '13px' }}
                  >
                    Add
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(localConfig.noPrefixUsers || []).length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>No users whitelisted for No Prefix mode.</div>
                  ) : (
                    (localConfig.noPrefixUsers || []).map(userId => (
                      <div key={userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                        <code style={{ fontSize: '12px', color: '#A78BFA' }}>{userId}</code>
                        <button 
                          onClick={() => handleRemoveNoPrefixUser(userId)}
                          style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AUTOMOD TAB */}
        {activeTab === 'automod' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>Auto-Moderation Settings</h2>
              <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>Configure automatic filters for spam, links, blacklisted words, and mentions.</p>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' }}>
              <GlowToggle 
                label="Global AutoMod System Enabled" 
                checked={!!localConfig.automod?.enabled} 
                onChange={() => handleUpdateAutoMod('enabled', !localConfig.automod?.enabled)} 
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>AutoMod Log Channel</label>
                <select 
                  className="glow-input"
                  value={localConfig.automod?.logChannelId || ''}
                  onChange={(e) => handleUpdateAutoMod('logChannelId', e.target.value || null)}
                >
                  <option value="">Select log channel...</option>
                  {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Mute / Timeout Duration (Minutes)</label>
                <input 
                  type="number" 
                  className="glow-input"
                  value={Math.round((localConfig.automod?.timeoutDuration || 600000) / 60000)}
                  onChange={(e) => handleUpdateAutoMod('timeoutDuration', Number(e.target.value) * 60000)}
                />
              </div>

              <hr style={{ border: '0', borderTop: '1px solid rgba(255,255,255,0.04)', margin: '16px 0' }} />

              {/* Sub-Filters Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* 1. Invite Links Filter */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: '0 0 4px' }}>Block Discord Invites</h4>
                    <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Automatically delete message and warn user if they post Discord server invites.</p>
                  </div>
                  <GlowToggle 
                    label=""
                    checked={!!localConfig.automod?.invite?.enabled}
                    onChange={() => handleUpdateAutoMod('invite.enabled', !localConfig.automod?.invite?.enabled)}
                  />
                </div>

                {/* 2. Web Links Filter */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: '0 0 4px' }}>Block Web Links</h4>
                    <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Deletes messages containing websites or links from non-whitelisted domains.</p>
                  </div>
                  <GlowToggle 
                    label=""
                    checked={!!localConfig.automod?.link?.enabled}
                    onChange={() => handleUpdateAutoMod('link.enabled', !localConfig.automod?.link?.enabled)}
                  />
                </div>

                {/* 3. Spam & Flood Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: '0 0 4px' }}>Anti-Spam / Message Flood</h4>
                      <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Warns or mutes members who send too many messages quickly.</p>
                    </div>
                    <GlowToggle 
                      label=""
                      checked={!!localConfig.automod?.spam?.enabled}
                      onChange={() => handleUpdateAutoMod('spam.enabled', !localConfig.automod?.spam?.enabled)}
                    />
                  </div>
                  {localConfig.automod?.spam?.enabled && (
                    <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#9CA3AF' }}>Max Messages</label>
                        <input 
                          type="number" 
                          className="glow-input" 
                          value={localConfig.automod?.spam?.limit || 5} 
                          onChange={(e) => handleUpdateAutoMod('spam.limit', Number(e.target.value))}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#9CA3AF' }}>Time Interval (Seconds)</label>
                        <input 
                          type="number" 
                          className="glow-input" 
                          value={Math.round((localConfig.automod?.spam?.timeframe || 5000) / 1000)} 
                          onChange={(e) => handleUpdateAutoMod('spam.timeframe', Number(e.target.value) * 1000)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Bad Words Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: '0 0 4px' }}>Banned Words Filter</h4>
                      <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Censors custom blacklisted phrases or slurs in your server.</p>
                    </div>
                    <GlowToggle 
                      label=""
                      checked={!!localConfig.automod?.words?.enabled}
                      onChange={() => handleUpdateAutoMod('words.enabled', !localConfig.automod?.words?.enabled)}
                    />
                  </div>
                  {localConfig.automod?.words?.enabled && (
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#9CA3AF' }}>Blacklisted words (comma separated)</label>
                      <input 
                        type="text" 
                        className="glow-input" 
                        placeholder="slur1, slur2, badword"
                        value={(localConfig.automod?.words?.list || []).join(', ')} 
                        onChange={(e) => handleUpdateAutoMod('words.list', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      />
                    </div>
                  )}
                </div>

                {/* 5. Mass Mentions Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: '0 0 4px' }}>Anti-Mass Mention</h4>
                      <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>Block mass mention pings in a single message.</p>
                    </div>
                    <GlowToggle 
                      label=""
                      checked={!!localConfig.automod?.mentions?.enabled}
                      onChange={() => handleUpdateAutoMod('mentions.enabled', !localConfig.automod?.mentions?.enabled)}
                    />
                  </div>
                  {localConfig.automod?.mentions?.enabled && (
                    <div style={{ marginTop: '8px', maxWidth: '200px' }}>
                      <label style={{ fontSize: '11px', color: '#9CA3AF' }}>Max Mentions Allowed</label>
                      <input 
                        type="number" 
                        className="glow-input" 
                        value={localConfig.automod?.mentions?.limit || 5} 
                        onChange={(e) => handleUpdateAutoMod('mentions.limit', Number(e.target.value))}
                      />
                    </div>
                  )}
                </div>

              </div>

              <button className="glow-btn" onClick={() => onSaveConfig(localConfig)} style={{ marginTop: '16px' }}>
                <Save size={16} />
                <span>Save AutoMod Configuration</span>
              </button>
            </div>
          </div>
        )}

        {/* VERIFICATION SETUP TAB */}
        {activeTab === 'verification' && (
          <div className="animate-fade-in" style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>Member Verification Setup</h2>
                <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>Configure reaction/button verification prompts to block raiders and userbots.</p>
              </div>

              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <GlowToggle 
                  label="Enable Button Verification" 
                  checked={!!localConfig.verification?.enabled} 
                  onChange={() => handleUpdateVerification('enabled', !localConfig.verification?.enabled)} 
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Verification Channel</label>
                  <select 
                    className="glow-input"
                    value={localConfig.verification?.channelId || ''}
                    onChange={(e) => handleUpdateVerification('channelId', e.target.value || null)}
                  >
                    <option value="">Select channel...</option>
                    {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Verified Role (Given on click)</label>
                  <select 
                    className="glow-input"
                    value={localConfig.verification?.roleId || ''}
                    onChange={(e) => handleUpdateVerification('roleId', e.target.value || null)}
                  >
                    <option value="">Select verification role...</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Prompt Message Description</label>
                  <textarea 
                    rows={3}
                    className="glow-input"
                    placeholder="Click verify button to access server..."
                    value={localConfig.verification?.message || ''}
                    onChange={(e) => handleUpdateVerification('message', e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Button Label</label>
                  <input 
                    type="text" 
                    className="glow-input"
                    value={localConfig.verification?.buttonText || 'Verify'}
                    onChange={(e) => handleUpdateVerification('buttonText', e.target.value)}
                  />
                </div>

                <button className="glow-btn" onClick={() => onSaveConfig(localConfig)} style={{ marginTop: '8px' }}>
                  <Save size={16} />
                  <span>Save Verification Setup</span>
                </button>
              </div>
            </div>

            {/* Auto-Verify Anti-Bot Gate */}
            <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', margin: 0 }}>🛡️ Automatic Bypass Gates</h3>
                <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0, lineHeight: 1.5 }}>
                  Bypass the verification prompt automatically for trusted accounts (e.g. older accounts) to simplify onboarding.
                </p>

                <GlowToggle 
                  label="Enable Auto-Bypass" 
                  checked={!!localConfig.verification?.autoVerify?.enabled} 
                  onChange={() => {
                    const currentAuto = localConfig.verification?.autoVerify || { enabled: false, criteria: 'none' };
                    handleUpdateVerification('autoVerify', { ...currentAuto, enabled: !currentAuto.enabled });
                  }} 
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Bypass Criteria</label>
                  <select 
                    className="glow-input"
                    value={localConfig.verification?.autoVerify?.criteria || 'none'}
                    onChange={(e) => {
                      const currentAuto = localConfig.verification?.autoVerify || { enabled: false, criteria: 'none' };
                      handleUpdateVerification('autoVerify', { ...currentAuto, criteria: e.target.value });
                    }}
                  >
                    <option value="none">None</option>
                    <option value="account_age">Account Creation Age</option>
                    <option value="server_size">Server Member Count</option>
                  </select>
                </div>

                {localConfig.verification?.autoVerify?.criteria === 'account_age' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Minimum Account Age (Days)</label>
                    <input 
                      type="number" 
                      className="glow-input" 
                      value={localConfig.verification?.autoVerify?.accountAgeDays || 7}
                      onChange={(e) => {
                        const currentAuto = localConfig.verification?.autoVerify || { enabled: false, criteria: 'none' };
                        handleUpdateVerification('autoVerify', { ...currentAuto, accountAgeDays: Number(e.target.value) });
                      }}
                    />
                  </div>
                )}
              </div>
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
