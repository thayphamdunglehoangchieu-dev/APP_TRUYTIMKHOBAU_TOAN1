export async function callGeminiDirectly({
  contents,
  responseMimeType,
  responseSchema,
  temperature,
  userKey,
  userModel
}: {
  contents: any;
  responseMimeType?: string;
  responseSchema?: any;
  temperature?: number;
  userKey: string;
  userModel: string;
}) {
  if (!userKey || userKey.trim() === '') {
    throw new Error("Hệ thống chưa thiết lập Gemini API Key. Vui lòng cấu hình API Key trên Header.");
  }

  // Deduplicate and prioritize model cascade chain
  const modelChain = Array.from(new Set([
    userModel,
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-3.5-flash'
  ])).filter(Boolean);

  let lastError: any = null;
  let userModelError: any = null;
  
  for (let attempt = 0; attempt < modelChain.length; attempt++) {
    const currentModel = modelChain[attempt];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${userKey}`;
    
    try {
      console.log(`[Client Gemini] Attempt ${attempt + 1}/${modelChain.length} using ${currentModel}...`);
      
      let parts: any[] = [];
      if (typeof contents === 'string') {
        parts = [{ text: contents }];
      } else if (Array.isArray(contents)) {
        // If it's a multipart payload (e.g. file attachment base64 + text prompt)
        contents.forEach(item => {
          if (typeof item === 'string') {
            parts.push({ text: item });
          } else if (item && typeof item === 'object') {
            if (item.inlineData) {
              parts.push({
                inlineData: {
                  mimeType: item.inlineData.mimeType,
                  data: item.inlineData.data
                }
              });
            } else if (item.text) {
              parts.push({ text: item.text });
            }
          }
        });
      }

      const bodyPayload: any = {
        contents: [{ parts }],
        generationConfig: {
          temperature: temperature ?? 0.7,
        }
      };
      
      if (responseMimeType) {
        bodyPayload.generationConfig.responseMimeType = responseMimeType;
      }
      if (responseSchema) {
        bodyPayload.generationConfig.responseSchema = responseSchema;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload)
      });
      
      if (!res.ok) {
        const errText = await res.text();
        let parsedErr: any;
        try {
          parsedErr = JSON.parse(errText);
        } catch {
          parsedErr = null;
        }
        const apiErrorMsg = parsedErr?.error?.message || parsedErr?.error?.status || errText;
        throw new Error(apiErrorMsg || `HTTP error ${res.status}`);
      }
      
      const resJson = await res.json();
      const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Empty response content from Google AI Studio.");
      }
      return text;
    } catch (err: any) {
      console.warn(`[Client Gemini] Attempt ${attempt + 1} with ${currentModel} failed:`, err.message || err);
      lastError = err;
      if (currentModel === userModel) {
        userModelError = err;
      }
      // Wait before retrying with next model
      if (attempt < modelChain.length - 1) {
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  }
  
  throw userModelError || lastError;
}
