import React, { useState } from 'react';

const PromptOutput = ({ prompts }) => {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleCopy = async (prompt, index) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = (prompt, index) => {
    const blob = new Blob([prompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slide-prompt-${index + 1}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    const allPrompts = prompts.map((p, i) => `=== Slide ${i + 1}: ${p.title} ===\n\n${p.content}\n\n`).join('\n');
    const blob = new Blob([allPrompts], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all-slide-prompts.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!prompts || prompts.length === 0) {
    return null;
  }

  return (
    <div className="prompt-output">
      <div className="prompt-output-header">
        <h3>생성된 프롬프트 ({prompts.length}개)</h3>
        <button className="download-all-btn" onClick={handleDownloadAll}>
          전체 다운로드
        </button>
      </div>
      <div className="prompt-list">
        {prompts.map((prompt, index) => (
          <div key={index} className="prompt-card">
            <div className="prompt-card-header">
              <span className="prompt-number">Slide {index + 1}</span>
              <span className="prompt-title">{prompt.title}</span>
              <div className="prompt-actions">
                <button
                  className={`copy-btn ${copiedIndex === index ? 'copied' : ''}`}
                  onClick={() => handleCopy(prompt.content, index)}
                >
                  {copiedIndex === index ? '복사됨!' : '복사'}
                </button>
                <button
                  className="download-btn"
                  onClick={() => handleDownload(prompt.content, index)}
                >
                  다운로드
                </button>
              </div>
            </div>
            <div className="prompt-preview">
              <pre>{prompt.content}</pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromptOutput;
