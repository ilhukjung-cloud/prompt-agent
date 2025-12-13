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
    model: 'gemini-2.5-pro-preview-06-05',
    systemInstruction: {
      role: 'user',
      parts: [{ text: currentSystemPrompt }],
    },
  });

  chatSession = model.startChat({
    history: [],
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 8192,
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
    model: 'gemini-2.5-pro-preview-06-05',
    systemInstruction: {
      role: 'user',
      parts: [{ text: currentSystemPrompt }],
    },
  });

  chatSession = model.startChat({
    history: currentHistory,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 8192,
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

export const getChatHistory = () => {
  return chatSession?._history || [];
};
