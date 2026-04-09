import { GoogleGenAI, Type } from "@google/genai";
import { sharpenImage, enhanceContrast, resizeImage, binarizeImage } from "../utils/imageUtils";

export interface DetectionResult {
  plate: string;
  confidence: number;
  make?: string;
  model?: string;
  bbox?: { x: number; y: number; width: number; height: number };
  is_blurry?: boolean;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const detectPlate = async (base64Image: string, retryCount = 0): Promise<DetectionResult | null> => {
  const MAX_RETRIES = 6;
  const models = [
    "gemini-3.1-flash-lite-preview", 
    "gemini-3.1-pro-preview", 
    "gemini-flash-latest", 
    "gemini-3-flash-preview"
  ];
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    
    if (!process.env.GEMINI_API_KEY) {
      console.error("ANPR Service: GEMINI_API_KEY is missing!");
      return null;
    }

    // Resize original image to manage payload size (400 is sufficient for ANPR)
    const resizedOriginal = await resizeImage(base64Image, 400);
    console.log(`ANPR Payload size: ${Math.round(resizedOriginal.length / 1024)} KB`);

    const modelToUse = models[retryCount % models.length];

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: resizedOriginal.split(',')[1] || resizedOriginal,
            },
          },
          {
            text: `You are an expert ANPR system. Analyze the provided frame to detect the license plate.
            
            Perform a multi-pass analysis:
            - Pass 1: Detect the license plate number.
            - Pass 2: Identify the vehicle's make (e.g., Toyota, Maruti Suzuki, Honda) and model (e.g., Camry, Swift, City).
            - Pass 3: Cross-reference visual cues to resolve ambiguities in blurred or pixelated characters.
            
            Return the most accurate plate number, confidence score (0-1), bounding box coordinates, and the vehicle's make and model.
            If it's an Indian plate, ensure it follows the standard format (e.g., MH12AB1234 or DL1CA1234).
            Return ONLY a valid JSON object.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            plate: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            make: { type: Type.STRING },
            model: { type: Type.STRING },
            bbox: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                width: { type: Type.NUMBER },
                height: { type: Type.NUMBER },
              },
              required: ["x", "y", "width", "height"],
            },
            is_blurry: { type: Type.BOOLEAN },
          },
          required: ["plate", "confidence"],
        },
      },
    });

    const result = JSON.parse(response.text);
    
    // Regex validation for Indian plates (Refined)
    // Format: [State(2)][District(2)][Series(1 or 2)][Number(4)]
    // Also handles older formats or temporary ones
    const indianPlatePattern = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/;
    const cleanedPlate = result.plate.replace(/[^A-Z0-9]/g, '').toUpperCase();
    
    if (indianPlatePattern.test(cleanedPlate)) {
      result.confidence = Math.min(result.confidence + 0.15, 1.0);
    }

    return result;
  } catch (error: any) {
    console.error(`ANPR Detection Error (Attempt ${retryCount + 1}):`, error);

    // Handle 429 (Quota Exceeded), 503 (High Demand), network failures, or other transient errors
    const errorMessage = error?.message || String(error);
    const isQuotaExceeded = error?.status === "RESOURCE_EXHAUSTED" || error?.code === 429 || errorMessage.includes("Quota exceeded");
    const isTransientError = 
      isQuotaExceeded ||
      error?.status === "UNAVAILABLE" || 
      error?.code === 503 || 
      errorMessage.includes("high demand") ||
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("NetworkError");
    
    if (isTransientError && retryCount < MAX_RETRIES) {
      // Respect retry delay from API if provided, otherwise use exponential backoff
      let waitTime = Math.pow(2, retryCount) * 2000 + Math.random() * 1000;
      
      // Try to parse retryDelay from the error details if available
      try {
        const errorData = typeof error.message === 'string' ? JSON.parse(error.message) : error;
        const retryDelay = errorData?.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay;
        if (retryDelay) {
          const seconds = parseInt(retryDelay.replace('s', ''));
          if (!isNaN(seconds)) {
            waitTime = (seconds + 1) * 1000;
          }
        }
      } catch (e) {
        // Fallback to default wait time
      }

      if (isQuotaExceeded) {
        console.warn("Gemini API Quota Exceeded. Slowing down...");
        // If we don't have a specific delay, wait at least 30s
        waitTime = Math.max(waitTime, 30000); 
      }

      if (errorMessage.includes("Failed to fetch")) {
        console.warn("Network error detected. Retrying with longer delay...");
        waitTime = Math.max(waitTime, 5000); // Wait at least 5s for network issues
      }

      console.log(`Retrying in ${Math.round(waitTime)}ms...`);
      await sleep(waitTime);
      return detectPlate(base64Image, retryCount + 1);
    }

    if (isQuotaExceeded) {
      throw new Error("QUOTA_EXCEEDED");
    }

    return null;
  }
};

export const saveDetectionToBackend = async (detection: DetectionResult) => {
  try {
    const response = await fetch("/api/detections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(detection),
    });
    return await response.json();
  } catch (error) {
    console.error("Error saving detection:", error);
  }
};
