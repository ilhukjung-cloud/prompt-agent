import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT, PHASE_PROMPTS } from '../config/systemPrompt';

let genAI = null;
let chatSession = null;
let currentSystemPrompt = '';

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

  const phaseInstruction = PHASE_PROMPTS[phase] || '';
  currentSystemPrompt = `${SYSTEM_PROMPT}\n\n${phaseInstruction}`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    systemInstruction: {
      role: 'user',
      parts: [{ text: currentSystemPrompt }],
    },
  });

  chatSession = model.startChat({
    history: [],
    generationConfig: {
      temperature: 1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 65536,
      thinkingConfig: {
        thinkingBudget: 10000,
      },
    },
  });

  return chatSession;
};

export const updatePhase = (phase) => {
  if (!genAI) {
    throw new Error('Gemini가 초기화되지 않았습니다.');
  }

  const phaseInstruction = PHASE_PROMPTS[phase] || '';
  currentSystemPrompt = `${SYSTEM_PROMPT}\n\n${phaseInstruction}`;

  // 기존 히스토리 가져오기
  const currentHistory = chatSession?._history || [];

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    systemInstruction: {
      role: 'user',
      parts: [{ text: currentSystemPrompt }],
    },
  });

  chatSession = model.startChat({
    history: currentHistory,
    generationConfig: {
      temperature: 1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 65536,
      thinkingConfig: {
        thinkingBudget: 10000,
      },
    },
  });

  return chatSession;
};

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

export const sendMessageStream = async (message, onChunk) => {
  if (!chatSession) {
    throw new Error('채팅 세션이 시작되지 않았습니다.');
  }

  try {
    const result = await chatSession.sendMessageStream(message);
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
