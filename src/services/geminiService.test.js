import assert from 'node:assert';
import test from 'node:test';
import { convertToGeminiHistory } from './geminiService.js';
import { PHASE_PROMPTS } from '../config/systemPrompt.js';

test('convertToGeminiHistory keeps phase system prompts in history', () => {
  const history = [
    { role: 'system', content: PHASE_PROMPTS.diagnosis },
    { role: 'user', content: '테스트 주제' },
    { role: 'assistant', content: '응답' },
  ];

  const geminiHistory = convertToGeminiHistory(history);

  assert.strictEqual(geminiHistory.length, 3);
  assert.deepStrictEqual(geminiHistory[0], {
    role: 'user',
    parts: [{ text: PHASE_PROMPTS.diagnosis }],
  });
});
