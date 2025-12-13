import React from 'react';

const ChatMessage = ({ message, isUser, isStreaming }) => {
  // 마크다운 코드 블록을 감지하고 스타일링
  const formatMessage = (text) => {
    if (!text) return '';

    // 코드 블록 처리
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const content = part.slice(3, -3);
        const firstLineEnd = content.indexOf('\n');
        const language = firstLineEnd > 0 ? content.slice(0, firstLineEnd).trim() : '';
        const code = firstLineEnd > 0 ? content.slice(firstLineEnd + 1) : content;

        return (
          <div key={index} className="code-block">
            {language && <div className="code-language">{language}</div>}
            <pre>
              <code>{code}</code>
            </pre>
            <button
              className="copy-button"
              onClick={() => navigator.clipboard.writeText(code)}
            >
              복사
            </button>
          </div>
        );
      }

      // 인라인 코드 처리
      const inlineFormatted = part.split(/(`[^`]+`)/g).map((segment, i) => {
        if (segment.startsWith('`') && segment.endsWith('`')) {
          return <code key={i} className="inline-code">{segment.slice(1, -1)}</code>;
        }

        // 볼드 처리
        const boldFormatted = segment.split(/(\*\*[^*]+\*\*)/g).map((seg, j) => {
          if (seg.startsWith('**') && seg.endsWith('**')) {
            return <strong key={j}>{seg.slice(2, -2)}</strong>;
          }
          return seg;
        });

        return <span key={i}>{boldFormatted}</span>;
      });

      return <span key={index}>{inlineFormatted}</span>;
    });
  };

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'} ${isStreaming ? 'streaming' : ''}`}>
      <div className="message-avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="message-content">
        <div className="message-text">
          {formatMessage(message)}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
