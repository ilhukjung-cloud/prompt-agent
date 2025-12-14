// Gemini API를 사용한 이미지 생성 서비스
// Python 코드를 JavaScript로 변환

/**
 * 프롬프트로부터 이미지를 생성합니다
 * @param {string} prompt - 이미지 생성 프롬프트
 * @param {function} onProgress - 진행 상황 콜백 (선택사항)
 * @returns {Promise<{imageUrl: string, text: string}>} 생성된 이미지 URL과 텍스트
 */
export const generateImage = async (prompt, onProgress = null) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key가 설정되지 않았습니다.');
  }

  try {
    // Gemini API REST endpoint 사용
    const model = 'gemini-3-pro-image-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          imageSize: '1K', // 1024x1024
        },
      },
      tools: [
        {
          googleSearch: {},
        },
      ],
    };

    if (onProgress) {
      onProgress('이미지 생성 요청 중...');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Image generation error:', errorText);
      throw new Error(`이미지 생성 실패: ${response.status} ${response.statusText}`);
    }

    if (onProgress) {
      onProgress('이미지 생성 중...');
    }

    // Server-Sent Events 파싱
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let imageData = null;
    let imageType = null;
    let textContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr.trim() === '') continue;

          try {
            const data = JSON.parse(jsonStr);

            // 응답에서 파트 추출
            if (data.candidates && data.candidates[0]?.content?.parts) {
              const parts = data.candidates[0].content.parts;

              for (const part of parts) {
                // 이미지 데이터 추출
                if (part.inlineData) {
                  imageData = part.inlineData.data;
                  imageType = part.inlineData.mimeType;
                  if (onProgress) {
                    onProgress('이미지 데이터 수신 완료');
                  }
                }

                // 텍스트 추출
                if (part.text) {
                  textContent += part.text;
                }
              }
            }
          } catch (e) {
            console.warn('Failed to parse SSE data:', e);
          }
        }
      }
    }

    if (!imageData) {
      throw new Error('이미지 데이터를 받지 못했습니다.');
    }

    // Base64 데이터를 Blob으로 변환하여 URL 생성
    const binaryData = Uint8Array.from(atob(imageData), (c) => c.charCodeAt(0));
    const blob = new Blob([binaryData], { type: imageType || 'image/png' });
    const imageUrl = URL.createObjectURL(blob);

    if (onProgress) {
      onProgress('완료');
    }

    return {
      imageUrl,
      blob,
      mimeType: imageType || 'image/png',
      text: textContent,
    };
  } catch (error) {
    console.error('Image generation error:', error);
    throw error;
  }
};

/**
 * 이미지를 다운로드합니다
 * @param {Blob} blob - 이미지 Blob
 * @param {string} fileName - 저장할 파일명
 */
export const downloadImage = (blob, fileName = 'generated-image.png') => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
