import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT, PHASE_PROMPTS } from '../config/systemPrompt';

let genAI = null;
let chatSession = null;
let currentPhase = 'diagnosis';

export const initializeGemini = (apiKey) => {
  genAI = new GoogleGenerativeAI(apiKey);
};

export const startNewChat = (phase = 'diagnosis') => {
  if (!genAI) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API Key가 설정되지 않았습니다.');
    }
    initializeGemini(apiKey);
  }

  currentPhase = phase;

  // 전체 시스템 프롬프트 (모든 Phase 정보 포함)
  const fullSystemPrompt = `${SYSTEM_PROMPT}

[IMPORTANT: Phase Management]
- 현재 Phase: ${phase}
- Phase는 순차적으로 진행됩니다: diagnosis → structuring → detailing → promptGeneration
- 각 Phase가 완료되면 사용자 승인을 받고 다음 Phase로 자연스럽게 넘어가세요.
- 절대로 이전 Phase로 돌아가지 마세요. 이미 완료된 진단 내용을 다시 묻지 마세요.
- 사용자가 "좋아요", "승인", "다음" 등으로 답하면 현재 Phase를 완료 처리하고 다음으로 진행하세요.

${PHASE_PROMPTS[phase]}`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-preview',
    systemInstruction: {
      role: 'user',
      parts: [{ text: fullSystemPrompt }],
    },
  });

  chatSession = model.startChat({
    history: [],
    generationConfig: {
      temperature: 1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 65536,
    },
  });

  return chatSession;
};

export const updatePhase = (newPhase) => {
  // Phase만 업데이트하고 세션은 유지
  // 다음 메시지에서 Phase 전환 컨텍스트를 추가
  currentPhase = newPhase;
  return chatSession;
};

export const getCurrentPhase = () => currentPhase;

export const sendMessage = async (message) => {
  if (!chatSession) {
    throw new Error('채팅 세션이 시작되지 않았습니다.');
  }

  try {
    const result = await chatSession.sendMessage(message);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
};

export const sendMessageStream = async (message, onChunk, phaseContext = null) => {
  if (!chatSession) {
    throw new Error('채팅 세션이 시작되지 않았습니다.');
  }

  try {
    // Phase 전환 컨텍스트가 있으면 메시지에 추가
    let finalMessage = message;
    if (phaseContext) {
      finalMessage = `[System: Phase 전환 - 현재 ${phaseContext} 단계입니다. 이전 대화 내용을 기억하고 이어서 진행하세요. 절대 Phase 1부터 다시 시작하지 마세요.]

사용자 메시지: ${message}`;
    }

    const result = await chatSession.sendMessageStream(finalMessage);
    let fullText = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      onChunk(chunkText, fullText);
    }

    return fullText;
  } catch (error) {
    console.error('Gemini API Stream Error:', error);
    throw error;
  }
};

// 파일과 함께 메시지 전송 (멀티모달)
export const sendMessageWithFiles = async (message, files, onChunk) => {
  if (!chatSession) {
    throw new Error('채팅 세션이 시작되지 않았습니다.');
  }

  try {
    // 멀티파트 콘텐츠 구성
    const parts = [];

    // 파일들을 먼저 추가
    for (const file of files) {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.base64Data,
        },
      });
    }

    // 파일 분석 지시와 사용자 메시지 추가
    const fileNames = files.map((f) => f.name).join(', ');
    const analysisPrompt = `
[첨부된 파일 분석]
파일명: ${fileNames}

위 파일들을 분석해주세요. 이 파일들은 참고 자료로, 보고서 작성에 활용할 내용을 추출해주세요.
분석 시 다음 사항을 파악해주세요:
1. 문서의 주요 내용과 핵심 메시지
2. 사용된 시각화 요소와 레이아웃 스타일
3. 데이터나 통계 정보
4. 보고서 구조와 논리 흐름
5. 참고할 만한 디자인 요소

사용자 메시지: ${message}
`;

    parts.push({ text: analysisPrompt });

    // 스트리밍으로 전송
    const result = await chatSession.sendMessageStream(parts);
    let fullText = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      if (onChunk) {
        onChunk(chunkText, fullText);
      }
    }

    return fullText;
  } catch (error) {
    console.error('Gemini API File Analysis Error:', error);
    throw error;
  }
};

export const getChatHistory = () => {
  return chatSession?._history || [];
};
