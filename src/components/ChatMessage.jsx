import React from 'react';
import ReactMarkdown from 'react-markdown';

const ChatMessage = ({ message, isUser, isStreaming, files }) => {
  // 액션 아이템 추출 (번호 목록, 체크리스트, "해야 할 일" 등)
  const extractActionItems = (text) => {
    if (!text) return null;

    const actionPatterns = [
      /(?:해야\s*할\s*(?:일|작업|것)|할\s*일|Action\s*Items?|TODO|Tasks?|다음\s*단계|Next\s*Steps?)[\s:：]*\n((?:[-•*\d.]\s*.+\n?)+)/gi,
      /(?:^|\n)((?:\d+[.)]\s*.+\n?){2,})/g,
    ];

    const actions = [];
    for (const pattern of actionPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const items = match[1].split('\n').filter(line => line.trim());
        actions.push(...items);
      }
    }

    return actions.length > 0 ? [...new Set(actions)] : null;
  };

  const actionItems = !isUser ? extractActionItems(message) : null;

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'} ${isStreaming ? 'streaming' : ''}`}>
      <div className="message-avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="message-content">
        {files && (
          <div className="message-files">
            <span className="message-files-icon">📎</span>
            <span>{files}</span>
          </div>
        )}

        {/* 액션 아이템 하이라이트 박스 */}
        {actionItems && actionItems.length > 0 && (
          <div className="action-items-box">
            <div className="action-items-header">
              <span className="action-icon">📋</span>
              <span>해야 할 일</span>
            </div>
            <ul className="action-items-list">
              {actionItems.map((item, idx) => (
                <li key={idx}>{item.replace(/^[-•*\d.)\s]+/, '')}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="message-text">
          <ReactMarkdown
            components={{
              code({ node, inline, className, children, ...props }) {
                const code = String(children).replace(/\n$/, '');
                if (inline) {
                  return <code className="inline-code" {...props}>{children}</code>;
                }
                return (
                  <div className="code-block">
                    <pre>
                      <code {...props}>{code}</code>
                    </pre>
                    <button
                      className="copy-button"
                      onClick={() => navigator.clipboard.writeText(code)}
                    >
                      복사
                    </button>
                  </div>
                );
              },
              h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
              h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
              h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
              ul: ({ children }) => <ul className="md-ul">{children}</ul>,
              ol: ({ children }) => <ol className="md-ol">{children}</ol>,
              li: ({ children }) => <li className="md-li">{children}</li>,
              blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
              table: ({ children }) => <table className="md-table">{children}</table>,
            }}
          >
            {message || ''}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
