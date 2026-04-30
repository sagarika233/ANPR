import { GoogleGenAI, Type } from "@google/genai";
import { sharpenImage, enhanceContrast, resizeImage, calculateBlurScore, adaptiveThresholding } from "../utils/imageUtils";

export interface DetectionResult {
  plate: string;
  confidence: number;
  status: 'Valid' | 'Low Confidence' | 'Blurry Image';
  make?: string;
  model?: string;
  vehicle_type?: string;
  bbox?: { x: number; y: number; width: number; height: number };
  is_blurry?: boolean;
  is_enhanced?: boolean;
  image?: string;
  // Registry details
  owner_name?: string;
  registration_date?: string;
  fuel_type?: string;
  engine_number?: string;
  chassis_number?: string;
  // Metadata
  original_base64?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
};

const normalizePlate = (rawPlate: string): string => {
  // 1. Basic cleanup: Remove junk and normalize case
  let plate = rawPlate.replace(/[^A-Z0-9]/g, '').toUpperCase();
  
  // OCR Correction Maps: Specific to ANPR pitfalls
  const L_TO_D: Record<string, string> = { 
    'O': '0', 'I': '1', 'Z': '2', 'S': '5', 'B': '8', 
    'G': '6', 'Q': '0', 'D': '0', 'T': '7', 'E': '3',
    'A': '4', 'J': '7', 'L': '1', 'R': '2', 'K': '4',
    'P': '9', 'U': '0', 'V': '0', 'Y': '4'
  };
  const D_TO_L: Record<string, string> = { 
    '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B',
    '4': 'A', '6': 'G', '7': 'T', '3': 'E', '9': 'P'
  };
  
  // Official Indian State Codes (HSRP compliant)
  const stateCodes = ["AN", "AP", "AR", "AS", "BR", "CH", "CT", "DN", "DD", "DL", "GA", "GJ", "HR", "HP", "JK", "JH", "KA", "KL", "LA", "LD", "MP", "MH", "MN", "ML", "MZ", "NL", "OD", "PY", "PB", "RJ", "SK", "TN", "TS", "TR", "UP", "UK", "WB"];

  const correctCharacters = (str: string, map: Record<string, string>) => 
    str.split('').map(char => map[char] || char).join('');

  // Indian Standard: SS DD CC NNNN (e.g., MH 12 AB 1234)
  if (plate.length >= 7) {
    // Step 1: Standardize State (Must be Alpha)
    let state = correctCharacters(plate.substring(0, 2), D_TO_L);
    if (!stateCodes.includes(state)) {
      // If still not valid, try a more aggressive alphabetic correction
      state = state.split('').map(c => isNaN(Number(c)) ? c : D_TO_L[c] || 'X').join('');
    }

    // Step 2: Standardize District (Must be Numeric)
    let district = correctCharacters(plate.substring(2, 4), L_TO_D);

    // Step 3: Handle Category and Unique Number
    let tail = plate.substring(4);
    
    // Pattern: [Optional Category Alpha] + [Registration Number Digits]
    // Common case: category 1-2 letters, number 1-4 digits
    const match = tail.match(/^([A-Z0-9]+?)([0-9A-Z]{4})$/);
    if (match) {
      let category = match[1].split('').map(c => isNaN(Number(c)) ? c : D_TO_L[c] || c).join('');
      let number = correctCharacters(match[2], L_TO_D);
      return `${state} ${district} ${category} ${number}`.replace(/\s+/g, ' ').trim();
    }
    
    // Fallback: If no clear category break, use standard spacing
    let number = correctCharacters(tail.slice(-4), L_TO_D);
    let category = tail.slice(0, -4).split('').map(c => isNaN(Number(c)) ? c : D_TO_L[c] || c).join('');
    return `${state} ${district} ${category} ${number}`.replace(/\s+/g, ' ').trim();
  }

  return plate;
};

const detectionCache: Record<string, DetectionResult[]> = {};

export const detectPlate = async (base64Image: string, retryCount = 0): Promise<DetectionResult[] | null> => {
  const MAX_RETRIES = 6;
  
  const imageHash = hashString(base64Image);
  if (detectionCache[imageHash] && retryCount === 0) {
    console.log("ANPR: Returning cached consistent results for identical image.");
    return detectionCache[imageHash];
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  try {
    const blurScore = await calculateBlurScore(base64Image);
    const isImageBlurry = blurScore < 250; 
    
    // Manage payload size for browser stability and enhance for OCR
    const resizedOriginal = await resizeImage(base64Image, 800); 
    const sharpened = await sharpenImage(resizedOriginal);
    const contrastEnhanced = await enhanceContrast(sharpened);
    const adaptive = await adaptiveThresholding(contrastEnhanced);
    
    const cleanOrig = resizedOriginal.split(',')[1] || resizedOriginal;
    const cleanEnhanced = contrastEnhanced.split(',')[1] || contrastEnhanced;
    const cleanAdaptive = adaptive.split(',')[1] || adaptive;

    console.log(`ANPR Blur Score: ${Math.round(blurScore)}, Payload: ${Math.round(resizedOriginal.length / 1024)} KB`);

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanOrig,
              },
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanEnhanced,
              },
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanAdaptive,
              },
            },
            {
              text: `You are an ULTRA-ADVANCED YOLO-v8 Hyper-Precision ANPR & Vehicle Classification System.
            
            CORE MISSION: Extract license plates from any input, specifically optimized for:
            1. MOTION BLUR: Compensation for fast-moving vehicles.
            2. SEMI-BLUR/FOG: Advanced contrast-aware edge reconstruction using the provided Adaptive Threshold and Enhanced exposures.
            3. LOW RESOLUTION: Sub-pixel character inference.
            
            STAGE 1: NEURAL SEARCH & SEGMENTATION
            - Use the TRIPLE-input stream (Original + AI-Enhanced Edge Contrast + Adaptive Binary).
            - Execute YOLO-style scanning to localize all vehicles.
            - Extract license plate ROIs with sub-millimeter precision. Bounding boxes MUST be strictly character-aligned.
            
            STAGE 2: OCR UNDER EXTREME CONDITIONS (BLUR/SMUDGE)
            - Target: Indian Standard HSRP plates (High Security Registration Plates).
            - Logical Inference: If a character is partially obscured by blur, use standard patterns (SS DD CC NNNN) to infer the most probable character.
            - Comparison: Use the Adaptive Binary frame to isolate character shapes from the semi-blurry background.
            
            STAGE 3: CONFIDENCE SCORING
            - 'Valid': Confident match (>0.90).
            - 'Low Confidence': Readable but slightly ambiguous due to semi-blur (0.75-0.90).
            - 'Blurry Image': Severely impacted but attempted (0.50-0.75).
            
            OUTPUT SCHEMA (JSON ONLY):
            - detections: [{ plate, confidence, status, make, model, vehicle_type, bbox: {x,y,w,h}, is_blurry }]`,
            },
          ],
        },
      ],
      config: {
        temperature: 0,
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
                  status: {
                    type: Type.STRING,
                    description: "Status of detection: 'Valid', 'Low Confidence', or 'Blurry Image'",
                  },
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
                required: ["plate", "confidence", "status", "vehicle_type"],
              },
            },
          },
          required: ["detections"],
        },
      },
    });

    const text = response.text || "";
    const parsedData = JSON.parse(text);
    let detections: DetectionResult[] = parsedData.detections || [];

    if (isImageBlurry) {
      detections = detections.map(d => ({
        ...d,
        status: d.status === 'Valid' ? 'Low Confidence' : d.status,
        is_blurry: true
      }));
    }
    
    detections.forEach(det => {
      // Apply advanced position-aware OCR normalization
      det.plate = normalizePlate(det.plate);
      
      if (det.bbox) {
        const centerX = det.bbox.x + det.bbox.width / 2;
        const centerY = det.bbox.y + det.bbox.height / 2;
        const isSquare = det.bbox.height / det.bbox.width > 0.5;
        const targetRatio = isSquare ? 1.5 : 4.1;
        
        let finalWidth = det.bbox.width;
        let finalHeight = det.bbox.width / targetRatio;
        
        if (Math.abs(finalHeight - det.bbox.height) > det.bbox.height * 0.4) {
          finalHeight = det.bbox.height;
          finalWidth = det.bbox.height * targetRatio;
        }

        det.bbox = {
          x: centerX - finalWidth / 2,
          y: centerY - finalHeight / 2,
          width: finalWidth,
          height: finalHeight
        };
      }
    });

    const uniqueDetections: DetectionResult[] = [];
    const seenPlates = new Set<string>();

    const sortedDetections = [...detections]
      .filter(d => d.confidence >= 0.85 || d.status === 'Low Confidence' || d.status === 'Blurry Image')
      .sort((a, b) => b.confidence - a.confidence);

    for (const det of sortedDetections) {
      const plate = det.plate;
      if (seenPlates.has(plate)) continue;

      let isDuplicateSpatial = false;
      if (det.bbox) {
        for (const existing of uniqueDetections) {
          if (existing.bbox) {
            const x1 = Math.max(det.bbox.x, existing.bbox.x);
            const y1 = Math.max(det.bbox.y, existing.bbox.y);
            const x2 = Math.min(det.bbox.x + det.bbox.width, existing.bbox.x + existing.bbox.width);
            const y2 = Math.min(det.bbox.y + det.bbox.height, existing.bbox.y + existing.bbox.height);
            
            const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
            const area1 = det.bbox.width * det.bbox.height;
            const area2 = existing.bbox.width * existing.bbox.height;
            const unionArea = area1 + area2 - intersectionArea;
            const iou = intersectionArea / unionArea;

            if (iou > 0.5) {
              isDuplicateSpatial = true;
              break;
            }
          }
        }
      }

      if (!isDuplicateSpatial) {
        uniqueDetections.push(det);
        seenPlates.add(plate);
      }
    }

    if (uniqueDetections.length > 0) {
      detectionCache[imageHash] = uniqueDetections;
    }

    return uniqueDetections;
  } catch (error: any) {
    console.error(`ANPR Detection Error (Attempt ${retryCount + 1}):`, error);

    const errorMessage = error?.message || String(error);
    const isQuotaExceeded = errorMessage.includes("Quota exceeded") || errorMessage.includes("QUOTA_EXCEEDED") || error?.status === "RESOURCE_EXHAUSTED";
    
    if (isQuotaExceeded) {
      console.warn("ANPR: Quota exceeded. Halting retries.");
      throw new Error("QUOTA_EXCEEDED");
    }

    const isTransientError = 
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("NetworkError") ||
      errorMessage.includes("high demand") ||
      errorMessage.includes("UNAVAILABLE") ||
      error?.status === "UNAVAILABLE" ||
      error?.code === 503;
    
    if (isTransientError && retryCount < MAX_RETRIES) {
      let waitTime = Math.pow(2, retryCount) * 2000 + Math.random() * 1000;
      if (isQuotaExceeded) waitTime = Math.max(waitTime, 30000); 
      if (errorMessage.includes("Failed to fetch")) waitTime = Math.max(waitTime, 5000);

      console.log(`Retrying in ${Math.round(waitTime)}ms...`);
      await sleep(waitTime);
      return detectPlate(base64Image, retryCount + 1);
    }

    if (isQuotaExceeded) throw new Error("QUOTA_EXCEEDED");
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
