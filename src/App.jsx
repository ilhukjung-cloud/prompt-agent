import React, { useState, useEffect, useRef } from 'react';
import PhaseIndicator from './components/PhaseIndicator';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import PromptOutput from './components/PromptOutput';
import FileUpload from './components/FileUpload';
import { startNewChat, sendMessageStream, sendMessageWithFiles, updatePhase } from './services/geminiService';
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
      startNewChat('diagnosis');
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
      // 초기화되지 않은 경우, 파일을 대기 상태로 저장
      setPendingFiles(files);
      return;
    }

    // 파일과 함께 분석 요청
    await handleSendMessageWithFiles('첨부된 파일을 분석해주세요.', files);
  };

  // 파일과 함께 메시지 전송
  const handleSendMessageWithFiles = async (message, files) => {
    if (!message.trim() && files.length === 0) return;

    // 사용자 메시지 추가 (파일 정보 포함)
    const fileNames = files.map((f) => f.name).join(', ');
    const userMessage = {
      role: 'user',
      content: message,
      files: fileNames,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingMessage('');

    try {
      let fullResponse = '';

      await sendMessageWithFiles(message, files, (chunk, full) => {
        setStreamingMessage(full);
        fullResponse = full;
      });

      // 스트리밍 완료 후 메시지 추가
      setMessages((prev) => [...prev, { role: 'assistant', content: fullResponse }]);
      setStreamingMessage('');

      // 프롬프트 생성 단계에서 프롬프트 추출
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
      await handleSendMessageWithFiles(message, files);
      return;
    }

    // 사용자 메시지 추가
    const userMessage = { role: 'user', content: message };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingMessage('');

    try {
      let fullResponse = '';

      await sendMessageStream(message, (chunk, full) => {
        setStreamingMessage(full);
        fullResponse = full;
      });

      // 스트리밍 완료 후 메시지 추가
      setMessages((prev) => [...prev, { role: 'assistant', content: fullResponse }]);
      setStreamingMessage('');

      // 프롬프트 생성 단계에서 프롬프트 추출
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
    // 코드 블록에서 프롬프트 추출
    const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/g;
    const matches = [...text.matchAll(codeBlockRegex)];

    if (matches.length > 0) {
      const newPrompts = matches.map((match, index) => ({
        title: `Slide ${generatedPrompts.length + index + 1}`,
        content: match[1].trim(),
      }));

      // [Slide Title] 패턴에서 제목 추출 시도
      newPrompts.forEach((prompt) => {
        const titleMatch = prompt.content.match(/\[Slide Title\]:\s*(.+)/);
        if (titleMatch) {
          prompt.title = titleMatch[1].trim();
        }
      });

      setGeneratedPrompts((prev) => [...prev, ...newPrompts]);
    }
  };

  const handlePhaseChange = (newPhase) => {
    if (newPhase === currentPhase) return;

    // 현재 단계 완료로 표시
    if (!completedPhases.includes(currentPhase)) {
      setCompletedPhases((prev) => [...prev, currentPhase]);
    }

    setCurrentPhase(newPhase);
    updatePhase(newPhase);

    // 단계 변경 메시지 추가
    const phaseNames = {
      diagnosis: '진단',
      structuring: '구조화',
      detailing: '상세기획',
      promptGeneration: '프롬프트 생성',
    };

    setMessages((prev) => [
      ...prev,
      {
        role: 'system',
        content: `--- ${phaseNames[newPhase]} 단계로 이동합니다 ---`,
      },
    ]);
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

                {/* 파일 업로드 영역 */}
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

          {/* 대화 중 파일 업로드 */}
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
