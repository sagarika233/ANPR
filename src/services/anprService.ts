import { GoogleGenAI, Type } from "@google/genai";
import { sharpenImage, enhanceContrast, resizeImage, binarizeImage } from "../utils/imageUtils";

export interface DetectionResult {
  plate: string;
  confidence: number;
  make?: string;
  model?: string;
  vehicle_type?: string;
  bbox?: { x: number; y: number; width: number; height: number };
  is_blurry?: boolean;
  is_enhanced?: boolean;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const detectPlate = async (base64Image: string, retryCount = 0): Promise<DetectionResult[] | null> => {
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

    // Resize original image to manage payload size
    const resizedOriginal = await resizeImage(base64Image, 600);
    
    // Create an enhanced version for better OCR on blurred images
    const sharpened = await sharpenImage(resizedOriginal);
    const contrastEnhanced = await enhanceContrast(sharpened);
    
    console.log(`ANPR Payload size (Original): ${Math.round(resizedOriginal.length / 1024)} KB`);

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
            inlineData: {
              mimeType: "image/jpeg",
              data: contrastEnhanced.split(',')[1] || contrastEnhanced,
            },
          },
          {
            text: `You are an advanced Multi-Vehicle ANPR and classification system. 
            Identify EVERY vehicle and EVERY license plate in the image, scanning from background to foreground.
            
            VEHICLE SCOPE:
            - Categories: Cars, SUVs, Hatchbacks, Sedans, Trucks (Light/Heavy), Buses, Motorcycles, Scooters, Three-Wheelers (Auto Rickshaws), Vans.
            - Identification: For each vehicle, provide its type, brand (make), and specific model name.
            
            PLATE RECOGNITION (Handling Blur/Distance):
            - Reconstruct blurred characters using logical font-shape analysis.
            - Format for Indian Plates: [StateCode][DistrictCode][Series][Number].
            - Even if barely visible, provide your most likely read with a confidence score.
            
            MULTIPLE DETECTIONS:
            - If there are 5 vehicles, return 5 detection objects.
            - Ensure bounding boxes accurately enclose the license plate area.
            
            Return ONLY a valid JSON object with a 'detections' array.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  plate: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  make: { type: Type.STRING },
                  model: { type: Type.STRING },
                  vehicle_type: { type: Type.STRING },
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
                required: ["plate", "confidence", "vehicle_type"],
              }
            }
          },
          required: ["detections"],
        },
      },
    });

    const result = JSON.parse(response.text);
    const detections: DetectionResult[] = result.detections || [];
    
    // Regex validation for Indian plates (Refined)
    const indianPlatePattern = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/;
    
    // Common misidentifications in OCR
    const ocrCorrections: Record<string, string> = {
      '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B'
    };
    const reverseOcrCorrections: Record<string, string> = {
      'O': '0', 'I': '1', 'Z': '2', 'S': '5', 'B': '8', 'G': '6', 'Q': '0'
    };

    detections.forEach(det => {
      let plate = det.plate.replace(/[^A-Z0-9]/g, '').toUpperCase();
      
      // Attempt heuristic reconstruction if it's close to Indian format but failing
      // State code (first 2 chars) must be letters
      if (plate.length >= 2) {
        let state = plate.substring(0, 2);
        state = state.split('').map(char => isNaN(Number(char)) ? char : ocrCorrections[char] || char).join('');
        plate = state + plate.substring(2);
      }

      // District code (chars 3-4) must be digits
      if (plate.length >= 4) {
        let district = plate.substring(2, 4);
        const originalDistrict = district;
        district = district.split('').map(char => isNaN(Number(char)) ? reverseOcrCorrections[char] || char : char).join('');
        if (district !== originalDistrict) det.is_enhanced = true;
        plate = plate.substring(0, 2) + district + plate.substring(4);
      }
      
      det.plate = plate;
      
      if (indianPlatePattern.test(plate)) {
        det.confidence = Math.min(det.confidence + 0.15, 1.0);
        det.is_enhanced = true;
      }
    });

    return detections;
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
