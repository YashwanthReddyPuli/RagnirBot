import React from 'react';

export default function GlowToggle({ checked, onChange, label }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      userSelect: 'none',
      width: '100%',
      padding: '8px 0'
    }}>
      {label && <span style={{ fontWeight: '500', fontSize: '14px', color: '#9CA3AF' }}>{label}</span>}
      <div style={{ position: 'relative' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          style={{
            opacity: 0,
            width: 0,
            height: 0,
            position: 'absolute'
          }}
        />
        <div style={{
          width: '44px',
          height: '24px',
          backgroundColor: checked ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${checked ? '#7C3AED' : 'rgba(255, 255, 255, 0.1)'}`,
          borderRadius: '12px',
          transition: 'all 0.3s ease',
          boxShadow: checked ? '0 0 10px rgba(124, 58, 237, 0.4)' : 'none',
          position: 'relative'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            backgroundColor: checked ? '#FFFFFF' : '#9CA3AF',
            borderRadius: '50%',
            position: 'absolute',
            top: '3px',
            left: checked ? '23px' : '3px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: checked ? '0 0 4px rgba(124, 58, 237, 0.8)' : 'none'
          }} />
        </div>
      </div>
    </label>
  );
}
