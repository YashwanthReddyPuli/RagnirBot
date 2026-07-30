import React from 'react';

export default function DiscordPreview({ title, description, footer, content, color = '#7C3AED', authorName }) {
  // Convert custom mention tags like {user} to Discord blue links
  const formatDescription = (text) => {
    if (!text) return '';
    return text
      .replace(/{user}/g, '<span style="color: #5865F2; font-weight: 500; background: rgba(88, 101, 242, 0.1); padding: 0 4px; border-radius: 3px;">@Member</span>')
      .replace(/{server}/g, '<span style="font-weight: 600;">Server Name</span>')
      .replace(/{memberCount}/g, '<span style="font-weight: 600;">1,234</span>');
  };

  return (
    <div style={{
      backgroundColor: '#313338',
      color: '#dbdee1',
      fontFamily: '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
      fontSize: '15px',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid rgba(0, 0, 0, 0.2)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      maxWidth: '520px',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Message Header */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
        {/* Bot Avatar */}
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: '#5865F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '700',
          fontSize: '18px',
          color: '#ffffff',
          flexShrink: 0
        }}>
          R
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {/* Username & Bot Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ color: '#f2f3f5', fontWeight: '500', fontSize: '16px' }}>
              {authorName || 'Ragnir Bot'}
            </span>
            <span style={{
              backgroundColor: '#5865F2',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: '600',
              padding: '2px 4px',
              borderRadius: '3px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Bot
            </span>
            <span style={{ color: '#949ba4', fontSize: '12px', marginLeft: '4px' }}>
              Today at 12:00 PM
            </span>
          </div>

          {/* Optional Message Content */}
          {content && (
            <div 
              style={{ color: '#dbdee1', marginBottom: '8px', lineHeight: '1.375' }}
              dangerouslySetInnerHTML={{ __html: formatDescription(content) }}
            />
          )}

          {/* Embed Structure */}
          {(title || description || footer) && (
            <div style={{
              display: 'flex',
              backgroundColor: '#2b2d31',
              borderRadius: '4px',
              borderLeft: `4px solid ${color}`,
              width: 'fit-content',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{ padding: '12px 16px 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Embed Title */}
                {title && (
                  <div style={{ color: '#ffffff', fontWeight: '600', fontSize: '16px' }}>
                    {title}
                  </div>
                )}

                {/* Embed Description */}
                {description && (
                  <div 
                    style={{ color: '#dbdee1', fontSize: '14px', lineHeight: '1.375' }}
                    dangerouslySetInnerHTML={{ __html: formatDescription(description) }}
                  />
                )}

                {/* Embed Footer */}
                {footer && (
                  <div style={{ color: '#949ba4', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{footer}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
