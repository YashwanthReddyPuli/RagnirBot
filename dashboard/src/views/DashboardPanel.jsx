import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  TrendingUp, 
  Database, 
  ArrowLeft, 
  Trash2, 
  RefreshCw, 
  AlertTriangle,
  Save,
  Plus
} from 'lucide-react';
import GlowToggle from '../components/GlowToggle';
import DiscordPreview from '../components/DiscordPreview';

export default function DashboardPanel({ 
  guild, 
  config, 
  backups, 
  onSaveConfig, 
  onCreateBackup, 
  onBack, 
  token,
  triggerAlert,
  setBackups
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [channels, setChannels] = useState([]);
  const [localConfig, setLocalConfig] = useState(config);
  const [backupName, setBackupName] = useState('');
  const [showRestoreModal, setShowRestoreModal] = useState(null); // stores backupId to restore
  const [restoreConfirmText, setRestoreConfirmText] = useState('');

  // Fetch channels list for dropdown selectors
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

  // Sync state if config changes from prop updates
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const getGuildIconUrl = () => {
    if (!guild.icon) return null;
    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
  };

  const handleToggleFeature = (featureName) => {
    const updatedFeatures = {
      ...localConfig.features,
      [featureName]: !localConfig.features?.[featureName]
    };
    setLocalConfig({
      ...localConfig,
      features: updatedFeatures
    });
  };

  const handleUpdateField = (field, value) => {
    setLocalConfig({
      ...localConfig,
      [field]: value
    });
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
        triggerAlert('success', 'Server restoration has started in the background. Your connection may drop momentarily.');
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
      backgroundColor: '#060709',
      boxSizing: 'border-box'
    }}>
      {/* Sidebar Navigation */}
      <aside style={{
        width: '260px',
        borderRight: '1px solid rgba(255, 255, 255, 0.04)',
        background: 'rgba(13, 14, 18, 0.8)',
        backdropFilter: 'blur(16px)',
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

        {/* Guild Identifier */}
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
              backgroundColor: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '14px'
            }}>G</div>
          )}
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {guild.name}
            </div>
            <div style={{ fontSize: '11px', color: '#10B981' }}>Settings Panel</div>
          </div>
        </div>

        {/* Navigation Tabs list */}
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
              border: activeTab === 'overview' ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent',
              borderRadius: '8px',
              color: activeTab === 'overview' ? '#fff' : '#9CA3AF',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <LayoutDashboard size={18} />
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
              border: activeTab === 'welcome' ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent',
              borderRadius: '8px',
              color: activeTab === 'welcome' ? '#fff' : '#9CA3AF',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <MessageSquare size={18} />
            <span>Welcome Setup</span>
          </button>

          <button 
            onClick={() => setActiveTab('leveling')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              background: activeTab === 'leveling' ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
              border: activeTab === 'leveling' ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent',
              borderRadius: '8px',
              color: activeTab === 'leveling' ? '#fff' : '#9CA3AF',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <TrendingUp size={18} />
            <span>Leveling System</span>
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
              border: activeTab === 'backups' ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent',
              borderRadius: '8px',
              color: activeTab === 'backups' ? '#fff' : '#9CA3AF',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
          >
            <Database size={18} />
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
              <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>Snapshot stats and active core modules.</p>
            </div>

            {/* Quick Stats Rows */}
            <div className="grid-container">
              <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ color: '#9CA3AF', fontSize: '13px', marginBottom: '8px' }}>Total Backups</div>
                <div style={{ fontSize: '28px', fontWeight: '700' }}>{backups.length}</div>
              </div>
              <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ color: '#9CA3AF', fontSize: '13px', marginBottom: '8px' }}>Active Modules</div>
                <div style={{ fontSize: '28px', fontWeight: '700' }}>
                  {Object.values(localConfig.features || {}).filter(Boolean).length}
                </div>
              </div>
            </div>

            {/* Modules Check grid */}
            <div className="glass-panel" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 16px' }}>Active Modules Toggle</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <GlowToggle 
                  label="Welcome Greeting messages" 
                  checked={!!localConfig.features?.welcome} 
                  onChange={() => handleToggleFeature('welcome')} 
                />
                <GlowToggle 
                  label="XP and Leveling system" 
                  checked={!!localConfig.features?.leveling} 
                  onChange={() => handleToggleFeature('leveling')} 
                />
                <GlowToggle 
                  label="Audit logs logging" 
                  checked={!!localConfig.features?.logging} 
                  onChange={() => handleToggleFeature('logging')} 
                />
                <GlowToggle 
                  label="Support Ticket system" 
                  checked={!!localConfig.features?.tickets} 
                  onChange={() => handleToggleFeature('tickets')} 
                />
                <GlowToggle 
                  label="Automatic Giveaways" 
                  checked={!!localConfig.features?.giveaways} 
                  onChange={() => handleToggleFeature('giveaways')} 
                />
              </div>
              <button 
                className="glow-btn" 
                onClick={() => onSaveConfig(localConfig)}
                style={{ marginTop: '24px' }}
              >
                <Save size={16} />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        )}

        {/* WELCOME SETUP TAB */}
        {activeTab === 'welcome' && (
          <div className="animate-fade-in" style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>Welcome Greeting Setup</h2>
                <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>Configure embeds sent when new users join.</p>
              </div>

              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <GlowToggle 
                  label="Enable Welcome Messages" 
                  checked={!!localConfig.features?.welcome} 
                  onChange={() => handleToggleFeature('welcome')} 
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Welcome Channel</label>
                  <select 
                    className="glow-input"
                    value={localConfig.welcomeChannel || ''}
                    onChange={(e) => handleUpdateField('welcomeChannel', e.target.value)}
                  >
                    <option value="">Select a text channel...</option>
                    {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Welcome Embed Title</label>
                  <input 
                    type="text" 
                    className="glow-input"
                    value={localConfig.welcomeTitle || 'Welcome to the Server!'} 
                    onChange={(e) => handleUpdateField('welcomeTitle', e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>Welcome Embed Description</label>
                  <textarea 
                    rows={4}
                    className="glow-input"
                    value={localConfig.welcomeMessage || 'Welcome {user} to {server}! We now have {memberCount} members.'}
                    onChange={(e) => handleUpdateField('welcomeMessage', e.target.value)}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <div style={{ fontSize: '11px', color: '#4B5563' }}>
                    Placeholders: <code>{"{user}"}</code> (mention member), <code>{"{server}"}</code>, <code>{"{memberCount}"}</code>
                  </div>
                </div>

                <button className="glow-btn" onClick={() => onSaveConfig(localConfig)}>
                  <Save size={16} />
                  <span>Save Config</span>
                </button>
              </div>
            </div>

            {/* Live Preview Column */}
            <div style={{ width: '450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#9CA3AF', margin: 0 }}>Live Discord Embed Preview</h3>
              <DiscordPreview 
                title={localConfig.welcomeTitle || 'Welcome to the Server!'}
                description={localConfig.welcomeMessage || 'Welcome {user} to {server}! We now have {memberCount} members.'}
                footer="Ragnir Bot Embed Preview"
                color="#7C3AED"
              />
            </div>
          </div>
        )}

        {/* LEVELING TAB */}
        {activeTab === 'leveling' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>Leveling System Settings</h2>
              <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>Configure XP multipliers and active level states.</p>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(255,255,255,0.04)', maxWidth: '600px' }}>
              <GlowToggle 
                label="Enable Leveling System" 
                checked={!!localConfig.features?.leveling} 
                onChange={() => handleToggleFeature('leveling')} 
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#9CA3AF' }}>XP Formula Multiplier</label>
                <input 
                  type="number" 
                  className="glow-input"
                  value={localConfig.xpMultiplier || 1}
                  onChange={(e) => handleUpdateField('xpMultiplier', Number(e.target.value))}
                  min={0.1}
                  max={10}
                  step={0.1}
                />
              </div>

              <button className="glow-btn" onClick={() => onSaveConfig(localConfig)}>
                <Save size={16} />
                <span>Save Leveling</span>
              </button>
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
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'flex-end', gap: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
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
            <div className="glass-panel" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 16px' }}>Saved Backups List</h3>
              
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
                        borderRadius: '8px',
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

      {/* DANGEROUS ACTION RESTORE MODAL */}
      {showRestoreModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(6, 7, 9, 0.8)',
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
