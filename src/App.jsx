import React, { useState, useEffect, useRef } from 'react';
import PhaseIndicator from './components/PhaseIndicator';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import PromptOutput from './components/PromptOutput';
import FileUpload from './components/FileUpload';
import { startNewChat, sendMessageWithHistory, sendMessageWithFiles } from './services/geminiService';
import './App.css';

function App() {
  const [currentPhase, setCurrentPhase] = useState('diagnosis');
  const [completedPhases, setCompletedPhases] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [generatedPrompts, setGeneratedPrompts] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  // 초기 채팅 시작
  const initializeChat = async (topic) => {
    try {
      setError(null);
      startNewChat();
      setIsInitialized(true);

      // 첫 메시지로 주제 전송
      await handleSendMessage(topic, true);
    } catch (err) {
      setError(err.message);
      console.error('Failed to initialize chat:', err);
    }
  };

  // 파일 분석 처리
  const handleFileAnalyzed = async (files) => {
    if (!isInitialized) {
      setPendingFiles(files);
      return;
    }

    await handleSendMessageWithFilesInternal('첨부된 파일을 분석해주세요.', files);
  };

  // 파일과 함께 메시지 전송
  const PROMPT_OUTPUT_FORMAT_INSTRUCTION =
    '프롬프트 생성 시 슬라이드별로 명확한 구분자를 사용해주세요.\n' +
    '옵션 A (권장):<<<SLIDE 1>>> ... <<<END>>> 형식으로 모든 슬라이드를 감싸세요.\n' +
    '옵션 B: JSON 배열로 [{ "slideNumber": 1, "title": "...", "prompt": "...", "resolution": "16:9" }, ...] 만을 반환하세요.\n' +
    '각 슬라이드 프롬프트에는 [Slide Title], [Layout Specification], [Zone A - Header Area], [Zone B - Main Visual Area], [Zone C - Supporting Area], [Text Content - EXACT WORDING], [Visual Style Keywords], [Color Palette] 섹션이 모두 포함되어야 합니다.\n' +
    '추가 설명 없이 위 출력 형식만 답변하세요.';

  const appendPromptFormatInstruction = (message) => {
    if (currentPhase !== 'promptGeneration') return message;
    return `${message}\n\n${PROMPT_OUTPUT_FORMAT_INSTRUCTION}`;
  };

  const handleSendMessageWithFilesInternal = async (message, files) => {
    if (!message.trim() && files.length === 0) return;

    const fileNames = files.map((f) => f.name).join(', ');
    const userMessage = {
      role: 'user',
      content: message,
      files: fileNames,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setStreamingMessage('');

    try {
      let fullResponse = '';

      // 히스토리를 직접 전달
      const outboundMessage = appendPromptFormatInstruction(message);
      await sendMessageWithFiles(outboundMessage, files, messages, (chunk, full) => {
        setStreamingMessage(full);
        fullResponse = full;
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: fullResponse }]);
      setStreamingMessage('');

      if (currentPhase === 'promptGeneration') {
        extractPrompts(fullResponse);
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to send message with files:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (message, isInit = false) => {
    if (!message.trim()) return;

    // 대기 중인 파일이 있으면 함께 전송
    if (pendingFiles.length > 0) {
      const files = pendingFiles;
      setPendingFiles([]);
      await handleSendMessageWithFilesInternal(message, files);
      return;
    }

    const userMessage = { role: 'user', content: message };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setStreamingMessage('');

    try {
      let fullResponse = '';

      // 히스토리를 직접 전달 (현재 메시지 제외한 이전 히스토리)
      const outboundMessage = appendPromptFormatInstruction(message);
      await sendMessageWithHistory(outboundMessage, messages, (chunk, full) => {
        setStreamingMessage(full);
        fullResponse = full;
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: fullResponse }]);
      setStreamingMessage('');

      if (currentPhase === 'promptGeneration') {
        extractPrompts(fullResponse);
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to send message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const extractPrompts = (text) => {
    const requiredFields = [
      '[Slide Title]',
      '[Layout Specification]',
      '[Zone A - Header Area]',
      '[Zone B - Main Visual Area]',
      '[Zone C - Supporting Area]',
      '[Text Content - EXACT WORDING]',
      '[Visual Style Keywords]',
      '[Color Palette]',
    ];

    const validatePrompt = (promptContent, index) => {
      const missingFields = requiredFields.filter((field) => !promptContent.includes(field));
      if (missingFields.length > 0) {
        return {
          isValid: false,
          message: `Slide ${index + 1} 프롬프트에 ${missingFields.join(', ')} 섹션이 누락되었습니다.`,
        };
      }
      return { isValid: true };
    };

    const parseDelimitedPrompts = () => {
      const slideRegex = /<<<SLIDE\s*(\d+)[^>]*>>>([\s\S]*?)(?=(<<<SLIDE\s*\d+[^>]*>>>|<<<END>>>|$))/gi;
      const slides = [];
      let match;

      while ((match = slideRegex.exec(text)) !== null) {
        const slideNumber = parseInt(match[1], 10);
        const content = match[2].trim();
        slides.push({
          title: `Slide ${slideNumber}`,
          content,
        });
      }

      return slides;
    };

    const parseJsonPrompts = () => {
      const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
      const plainJsonMatch = text.match(/(\[\s*\{[\s\S]*\}\s*\])/);
      const rawJson = jsonBlockMatch?.[1] || plainJsonMatch?.[1];

      if (!rawJson) return [];

      try {
        const parsed = JSON.parse(rawJson);
        if (!Array.isArray(parsed)) return [];

        return parsed
          .map((slide, index) => {
            const content = slide.prompt || slide.content || '';
            return {
              title: slide.title || slide.slideTitle || `Slide ${slide.slideNumber || index + 1}`,
              content: content.trim(),
            };
          })
          .filter((slide) => slide.content);
      } catch (err) {
        console.error('JSON parsing failed:', err);
        return [];
      }
    };

    const parseCodeBlockPrompts = () => {
      const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/g;
      const matches = [...text.matchAll(codeBlockRegex)];

      return matches.map((match) => ({
        title: 'Slide',
        content: match[1].trim(),
      }));
    };

    const parsedPrompts = [parseDelimitedPrompts(), parseJsonPrompts(), parseCodeBlockPrompts()]
      .find((result) => result.length > 0) || [];

    if (parsedPrompts.length === 0) {
      setError('생성된 프롬프트 형식을 해석할 수 없습니다. SLIDE 구분자 혹은 JSON 배열 형식을 사용해주세요.');
      return;
    }

    const validatedPrompts = [];
    const warnings = [];

    parsedPrompts.forEach((prompt, index) => {
      const titleMatch = prompt.content.match(/\[Slide Title\]:\s*(.+)/);
      const title = titleMatch ? titleMatch[1].trim() : prompt.title;
      const validation = validatePrompt(prompt.content, index);

      if (validation.isValid) {
        validatedPrompts.push({
          title,
          content: prompt.content,
        });
      } else if (validation.message) {
        warnings.push(validation.message);
      }
    });

    if (warnings.length > 0) {
      setError(warnings.join(' '));
    } else {
      setError(null);
    }

    if (validatedPrompts.length > 0) {
      setGeneratedPrompts((prev) => [...prev, ...validatedPrompts]);
    }
  };

  const handlePhaseChange = async (newPhase) => {
    if (newPhase === currentPhase) return;

    if (!completedPhases.includes(currentPhase)) {
      setCompletedPhases((prev) => [...prev, currentPhase]);
    }

    const phaseNames = {
      diagnosis: '진단',
      structuring: '구조화',
      detailing: '상세기획',
      promptGeneration: '프롬프트 생성',
    };

    setCurrentPhase(newPhase);

    // 시스템 메시지 추가
    const systemMessage = {
      role: 'system',
      content: `--- ${phaseNames[newPhase]} 단계로 이동합니다 ---`,
    };

    const updatedMessages = [...messages, systemMessage];
    setMessages(updatedMessages);

    // Phase 전환 시 AI에게 요청
    setIsLoading(true);
    setStreamingMessage('');

    try {
      let fullResponse = '';
      const phaseMessage = `[Phase 전환] 이제 ${phaseNames[newPhase]} 단계입니다. 위의 모든 대화 내용을 바탕으로 ${phaseNames[newPhase]} 단계를 진행해주세요.`;
      const outboundMessage = appendPromptFormatInstruction(phaseMessage);

      // 업데이트된 메시지 히스토리를 직접 전달
      await sendMessageWithHistory(outboundMessage, updatedMessages, (chunk, full) => {
        setStreamingMessage(full);
        fullResponse = full;
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: fullResponse }]);
      setStreamingMessage('');

      if (newPhase === 'promptGeneration') {
        extractPrompts(fullResponse);
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to transition phase:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextPhase = () => {
    const phases = ['diagnosis', 'structuring', 'detailing', 'promptGeneration'];
    const currentIndex = phases.indexOf(currentPhase);
    if (currentIndex < phases.length - 1) {
      handlePhaseChange(phases[currentIndex + 1]);
    }
  };

  const handleReset = () => {
    setCurrentPhase('diagnosis');
    setCompletedPhases([]);
    setMessages([]);
    setGeneratedPrompts([]);
    setIsInitialized(false);
    setError(null);
    setPendingFiles([]);
  };

  const getPlaceholder = () => {
    if (!isInitialized) {
      if (pendingFiles.length > 0) {
        return `${pendingFiles.length}개 파일이 첨부됨 - 보고서 주제를 입력하세요`;
      }
      return '보고서 주제를 입력하세요 (예: 사내 보안 강화 방안)';
    }

    const placeholders = {
      diagnosis: '질문에 답변해주세요...',
      structuring: '목차에 대한 피드백이나 승인을 해주세요...',
      detailing: '슬라이드 기획에 대한 피드백이나 승인을 해주세요...',
      promptGeneration: '프롬프트 생성을 요청하거나 수정사항을 말씀해주세요...',
    };
    return placeholders[currentPhase];
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Strategy Report Prompt Generator</h1>
        <p>Nano Banana Pro용 전략 보고서 슬라이드 프롬프트 생성기</p>
        {isInitialized && (
          <button className="reset-btn" onClick={handleReset}>
            새로 시작
          </button>
        )}
      </header>

      {isInitialized && (
        <PhaseIndicator
          currentPhase={currentPhase}
          onPhaseClick={handlePhaseChange}
          completedPhases={completedPhases}
        />
      )}

      <main className="main-content">
        <div className="chat-container">
          {!isInitialized ? (
            <div className="welcome-screen">
              <div className="welcome-content">
                <h2>전략 보고서 프롬프트 생성기</h2>
                <p>
                  McKinsey/BCG 스타일의 전문적인 전략 보고서 슬라이드를 위한
                  <br />
                  Nano Banana Pro 이미지 생성 프롬프트를 만들어 드립니다.
                </p>
                <div className="workflow-preview">
                  <div className="workflow-step">
                    <span className="step-icon">🔍</span>
                    <span>진단</span>
                  </div>
                  <span className="workflow-arrow">→</span>
                  <div className="workflow-step">
                    <span className="step-icon">📋</span>
                    <span>구조화</span>
                  </div>
                  <span className="workflow-arrow">→</span>
                  <div className="workflow-step">
                    <span className="step-icon">📝</span>
                    <span>상세기획</span>
                  </div>
                  <span className="workflow-arrow">→</span>
                  <div className="workflow-step">
                    <span className="step-icon">🎨</span>
                    <span>프롬프트</span>
                  </div>
                </div>

                <div className="file-upload-section">
                  <FileUpload
                    onFileAnalyzed={(files) => setPendingFiles(files)}
                    disabled={isLoading}
                  />
                  {pendingFiles.length > 0 && (
                    <div className="pending-files-notice">
                      <span>📎 {pendingFiles.length}개 파일 첨부됨</span>
                      <span className="pending-files-hint">
                        아래에 보고서 주제를 입력하면 파일과 함께 분석됩니다
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="messages-container">
              {messages.map((msg, index) =>
                msg.role === 'system' ? (
                  <div key={index} className="system-message">
                    {msg.content}
                  </div>
                ) : (
                  <ChatMessage
                    key={index}
                    message={msg.content}
                    isUser={msg.role === 'user'}
                    files={msg.files}
                  />
                )
              )}
              {streamingMessage && (
                <ChatMessage
                  message={streamingMessage}
                  isUser={false}
                  isStreaming={true}
                />
              )}
              {isLoading && !streamingMessage && (
                <div className="loading-indicator">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {error && (
            <div className="error-message">
              <span>⚠️ {error}</span>
              <button onClick={() => setError(null)}>닫기</button>
            </div>
          )}

          {isInitialized && (
            <div className="inline-file-upload">
              <FileUpload
                onFileAnalyzed={handleFileAnalyzed}
                disabled={isLoading}
              />
            </div>
          )}

          <div className="chat-input-container">
            {isInitialized && currentPhase !== 'promptGeneration' && (
              <button
                className="next-phase-btn"
                onClick={handleNextPhase}
                disabled={isLoading}
              >
                다음 단계로 →
              </button>
            )}
            <ChatInput
              onSend={isInitialized ? handleSendMessage : initializeChat}
              disabled={isLoading}
              placeholder={getPlaceholder()}
            />
          </div>
        </div>

        {generatedPrompts.length > 0 && (
          <aside className="sidebar">
            <PromptOutput prompts={generatedPrompts} />
          </aside>
        )}
      </main>
    </div>
  );
}

export default App;
