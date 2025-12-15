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

  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });

    if (onProgress) {
      onProgress('이미지 생성 요청 중...');
    }

    const result = await model.generateContentStream({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          imageSize: '1K',
        },
      },
    });

    if (onProgress) {
      onProgress('이미지 생성 중...');
    }

    let imageData = null;
    let imageType = null;
    let textContent = '';

    for await (const chunk of result.stream) {
      const parts = chunk.candidates?.[0]?.content?.parts ?? [];

      for (const part of parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
          imageType = part.inlineData.mimeType;

          if (onProgress) {
            onProgress('이미지 데이터 수신 완료');
          }
        }

        if (part.text) {
          textContent += part.text;
        }
      }
    }

    if (!imageData) {
      throw new Error('이미지 데이터를 받지 못했습니다.');
    }

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
