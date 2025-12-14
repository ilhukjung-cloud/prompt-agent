import React, { useState } from 'react';
import { generateImage, downloadImage } from '../services/imageGenerationService';

const PromptOutput = ({ prompts }) => {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [generatingIndex, setGeneratingIndex] = useState(null);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generatedImages, setGeneratedImages] = useState({});

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

  const handleGenerateImage = async (prompt, index) => {
    try {
      setGeneratingIndex(index);
      setGenerationProgress('이미지 생성 시작...');

      const result = await generateImage(prompt.content, (progress) => {
        setGenerationProgress(progress);
      });

      setGeneratedImages((prev) => ({
        ...prev,
        [index]: result,
      }));

      setGenerationProgress('');
    } catch (error) {
      console.error('Image generation failed:', error);
      setGenerationProgress('');
      alert(`이미지 생성 실패: ${error.message}`);
    } finally {
      setGeneratingIndex(null);
    }
  };

  const handleDownloadGeneratedImage = (index) => {
    const image = generatedImages[index];
    if (image && image.blob) {
      downloadImage(image.blob, `slide-${index + 1}-image.png`);
    }
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
                <button
                  className="generate-image-btn"
                  onClick={() => handleGenerateImage(prompt, index)}
                  disabled={generatingIndex === index}
                >
                  {generatingIndex === index ? '생성 중...' : '🎨 이미지 생성'}
                </button>
              </div>
            </div>
            {generatingIndex === index && generationProgress && (
              <div className="generation-progress">
                {generationProgress}
              </div>
            )}
            <div className="prompt-preview">
              <pre>{prompt.content}</pre>
            </div>
            {generatedImages[index] && (
              <div className="generated-image-container">
                <div className="generated-image-header">
                  <span>생성된 이미지</span>
                  <button
                    className="download-image-btn"
                    onClick={() => handleDownloadGeneratedImage(index)}
                  >
                    이미지 다운로드
                  </button>
                </div>
                <img
                  src={generatedImages[index].imageUrl}
                  alt={`Generated for ${prompt.title}`}
                  className="generated-image"
                />
                {generatedImages[index].text && (
                  <div className="generated-image-text">
                    <p>{generatedImages[index].text}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromptOutput;
