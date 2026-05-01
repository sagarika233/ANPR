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
  // Enhanced normalization focused on Indian HSRP standards (SS DD Series ####)
  // 1. Basic cleanup: Remove junk, spaces, and normalize case
  let plate = rawPlate.replace(/[^A-Z0-9]/g, '').toUpperCase();
  
  // 2. Remove common OCR noise or prefixes
  plate = plate.replace(/^INDIA|^IND/i, '');

  if (plate.length < 4) return plate;

  // Comprehensive OCR Correction Maps
  // Letters that are often misread as Digits
  const L_TO_D: Record<string, string> = { 
    'O': '0', 'I': '1', 'Z': '2', 'S': '5', 'B': '8', 
    'G': '6', 'Q': '0', 'D': '0', 'T': '7', 'L': '1',
    'A': '4', 'E': '3', 'J': '9'
  };
  // Digits that are often misread as Letters
  const D_TO_L: Record<string, string> = { 
    '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B',
    '4': 'A', '6': 'G', '7': 'T', '3': 'E', '9': 'J'
  };
  
  const stateCodes = [
    "AN", "AP", "AR", "AS", "BR", "CH", "CT", "DN", "DD", "DL", "GA", "GJ", "HR", "HP", 
    "JK", "JH", "KA", "KL", "LA", "LD", "MP", "MH", "MN", "ML", "MZ", "NL", "OD", "PY", 
    "PB", "RJ", "SK", "TN", "TS", "TR", "UP", "UK", "WB", "BH", "TG"
  ];

  // Helper to correct string based on map
  const fix = (s: string, m: Record<string, string>) => s.split('').map(c => m[c] || c).join('');

  // 1. Handle BH Series: YY BH #### XX (Example: 22 BH 1234 AA)
  // Check if plate contains 'BH' specifically in positions 2-3 (0-indexed) or has 2 digits + BH
  if (plate.includes('BH') || (plate.length >= 8 && /^[0-9OIZ]{2}BH/.test(plate))) {
    const bhMatch = plate.match(/^([A-Z0-9]{2})BH([A-Z0-9]{4})([A-Z0-9]{1,2})$/);
    if (bhMatch) {
      const year = fix(bhMatch[1], L_TO_D);
      const num = fix(bhMatch[2], L_TO_D);
      const series = fix(bhMatch[3], D_TO_L);
      return `${year} BH ${num} ${series}`;
    }
  }

  // 2. Handle standard series: SS DD Series #### (Example: MH 12 AB 1234)
  // SS: State Code (MUST be Letters, e.g., MH, DL, KA)
  let state = fix(plate.substring(0, 2), D_TO_L);
  
  // DD: District Code (MUST be Digits, e.g., 01, 12, 03)
  let district = "";
  let rest = "";
  
  if (plate.length >= 4) {
    district = fix(plate.substring(2, 4), L_TO_D);
    rest = plate.substring(4);
  } else if (plate.length > 2) {
    district = fix(plate.substring(2), L_TO_D);
  }

  // Series and Unique Number (e.g., CA 1234, AB 5678)
  if (rest.length > 0) {
    // Case 1: Rest is entirely numeric-like (e.g., MH 12 1234)
    if (/^[0-9OIZSBGQD]+$/.test(rest)) {
      return `${state} ${district} ${fix(rest, L_TO_D)}`.trim();
    }
    
    // Case 2: Standard split (Series + Number)
    // Indian HSRP uniquely identifies plates by 1-4 numeric digits at the VERY end
    const numericTailMatch = rest.match(/([0-9OIZSBGQD]+)$/);
    if (numericTailMatch) {
      const rawNum = numericTailMatch[0];
      const seriesPartRaw = rest.substring(0, rest.length - rawNum.length);
      
      // Series should be letters, Number should be digits
      const seriesPart = fix(seriesPartRaw, D_TO_L);
      let numPart = fix(rawNum, L_TO_D);
      
      // HSRP unique numbers are strictly 1-4 digits. 
      // If we got more than 4, the series might have been misread as digits
      if (numPart.length > 4 && seriesPart === "") {
        // Example: "125678" might be "AB 5678" if "12" misread for "AB"
        // But more likely it's "AA 5678". We take last 4 as number if overall is long.
        const likelyNumPart = numPart.slice(-4);
        const likelySeriesPartRaw = numPart.slice(0, -4);
        const likelySeriesPart = fix(likelySeriesPartRaw, D_TO_L);
        return `${state} ${district} ${likelySeriesPart} ${likelyNumPart}`.trim();
      }

      return `${state} ${district} ${seriesPart} ${numPart}`.replace(/\s+/g, ' ').trim();
    } else {
      // If no numeric tail found, treat as series part (likely incomplete read)
      return `${state} ${district} ${fix(rest, D_TO_L)}`.trim();
    }
  }

  return `${state} ${district}`.trim();
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
    const resizedOriginal = await resizeImage(base64Image, 1024, 0.6); 
    const sharpened = await sharpenImage(resizedOriginal);
    const contrastEnhanced = await enhanceContrast(sharpened);
    const binarized = await adaptiveThresholding(contrastEnhanced);
    
    // We send three versions: 
    // 1. Resized high-quality original (best for vehicle/color details)
    // 2. Sharpened + Contrast Enhanced (best for reading dirty/low-contrast plates)
    // 3. Adaptive Binarized (best for character extraction in harsh lighting/shadows)
    const cleanOrig = resizedOriginal.split(',')[1] || resizedOriginal;
    const cleanEnhanced = contrastEnhanced.split(',')[1] || contrastEnhanced;
    const cleanBinarized = binarized.split(',')[1] || binarized;

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
                data: cleanBinarized,
              },
            },
            {
              text: `You are a world-class Automatic Number Plate Recognition (ANPR) system. 
            
            INPUT: Three images (Original, Enhanced Contrast, Adaptive Binarized).
            MISSION: Extract ALL license plates from the frame with absolute precision.
            
            REASONING PROCESS:
            1. Cross-reference all 3 versions of the image to resolve ambiguous characters.
            2. Use the Binarized version specifically for edge definition if characters seem to merge.
            3. Use the Enhanced Contrast version for reading plates in shadow or glare.
            
            INDIAN HSRP FORMAT KNOWLEDGE:
            - Standard: [State Code: 2 Letters] [District Code: 2 Digits] [Series: 1-2 Letters] [Unique Number: 1-4 Digits]
              Examples: 
              * DL 01 CA 1234 (Delhi, District 01, Series CA, Number 1234)
              * MH 12 AB 1234 (Maharashtra, District 12, Series AB, Number 1234)
              * KA 01 MJ 0987 (Karnataka, District 01, Series MJ, Number 0987)
            - Bharat (BH): [Year: 2 Digits] BH [Number: 4 Digits] [Series: 1-2 Alpha]
            - State Codes: MH, DL, KA, TS, HR, UP, TN, WB, GJ, RJ, MP, BR, KL, AS, PB, AP, AR, AS, BR, CH, CT, DN, DD, GA, HP, JK, JH, LA, LD, MN, ML, MZ, NL, OD, PY, SK, TR, UK, TG.
            
            CHARACTER DISAMBIGUATION RULES:
            - Position 1-2 (State): MUST be Letters. (e.g., '0'->'O', '1'->'I').
            - Position 3-4 (District): MUST be Digits. (e.g., 'S'->'5', 'G'->'6').
            - Last 4 characters (Number): Strictly Digits.
            - Disambiguate '0' vs 'O', '1' vs 'I', '5' vs 'S', '8' vs 'B', '2' vs 'Z', '6' vs 'G' using these position-based rules.
            
            OTHER INSTRUCTIONS:
            - Detect ALL visible plates.
            - Focus only on the main registration number. Ignore "IND", holograms, or logos.
            - Use the three images (Original, Enhanced, Binarized) to verify character shapes.
            - Identify Vehicle: Make, Model, Color, and Type.
            
            OUTPUT: Valid JSON only.`,
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
        const currentRatio = det.bbox.width / det.bbox.height;
        
        // Refined target ratios based on HSRP standards (4.1 for long, 1.7 for short/square)
        const isLong = currentRatio > 2.5;
        const targetRatio = isLong ? 4.1 : 1.72;
        
        let finalWidth = det.bbox.width;
        let finalHeight = det.bbox.width / targetRatio;
        
        // If the calculated height is too different from detected, we split the difference
        // This preserves some of the model's spatial context while cleaning up the HUD shape.
        if (Math.abs(finalHeight - det.bbox.height) > det.bbox.height * 0.3) {
          finalHeight = (finalHeight + det.bbox.height) / 2;
          finalWidth = finalHeight * targetRatio;
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
      .filter(d => d.confidence >= 0.70 || d.status === 'Low Confidence' || d.status === 'Blurry Image')
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
