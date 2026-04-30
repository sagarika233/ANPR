/**
 * Resizes an image to a maximum dimension while maintaining aspect ratio.
 * @param base64Image The source image in base64 format.
 * @param maxDimension The maximum width or height.
 * @param quality JPEG quality from 0 to 1.
 * @returns A promise that resolves to the resized base64 image.
 */
export const resizeImage = async (base64Image: string, maxDimension = 1024, quality = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDimension) {
          height *= maxDimension / width;
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width *= maxDimension / height;
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = base64Image;
  });
};

/**
 * Sharpens an image using a convolution filter on a canvas.
 * @param base64Image The source image in base64 format.
 * @returns A promise that resolves to the sharpened base64 image.
 */
export const sharpenImage = async (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = imageData.width;
      const height = imageData.height;

      // Stronger Sharpening Convolution Kernel
      // [ -1, -1, -1]
      // [ -1,  9, -1]
      // [ -1, -1, -1]
      const kernel = [
        -1, -1, -1,
        -1,  9, -1,
        -1, -1, -1
      ];

      const output = ctx.createImageData(width, height);
      const outputData = output.data;

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          for (let c = 0; c < 3; c++) { // RGB
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const pixelIdx = ((y + ky) * width + (x + kx)) * 4 + c;
                const kernelIdx = (ky + 1) * 3 + (kx + 1);
                sum += data[pixelIdx] * kernel[kernelIdx];
              }
            }
            const idx = (y * width + x) * 4 + c;
            outputData[idx] = Math.min(255, Math.max(0, sum));
          }
          outputData[(y * width + x) * 4 + 3] = 255; // Alpha
        }
      }

      ctx.putImageData(output, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.5));
    };
    img.onerror = reject;
    img.src = base64Image;
  });
};

/**
 * Enhances the contrast of an image.
 * @param base64Image The source image in base64 format.
 * @returns A promise that resolves to the high-contrast base64 image.
 */
export const enhanceContrast = async (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Simple contrast enhancement: (pixel - 128) * contrast + 128
      const contrast = 1.5; 
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128));     // R
        data[i+1] = Math.min(255, Math.max(0, (data[i+1] - 128) * contrast + 128)); // G
        data[i+2] = Math.min(255, Math.max(0, (data[i+2] - 128) * contrast + 128)); // B
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.5));
    };
    img.onerror = reject;
    img.src = base64Image;
  });
};

/**
 * Applies a Gaussian blur to an image.
 */
export const gaussianBlur = async (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas ctx null'));
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      const outData = new Uint8ClampedArray(data.length);
      
      const kernel = [
        1, 2, 1,
        2, 4, 2,
        1, 2, 1
      ];
      const weight = 16;

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                sum += data[((y + ky) * width + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)];
              }
            }
            outData[(y * width + x) * 4 + c] = sum / weight;
          }
          outData[(y * width + x) * 4 + 3] = 255;
        }
      }
      for (let i = 0; i < data.length; i++) data[i] = outData[i];
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = base64Image;
  });
};

/**
 * Performs Canny-style edge detection to highlight structural boundaries.
 */
export const cannyEdgeDetection = async (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas ctx null'));
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      
      const grayscale = new Float32Array(width * height);
      for (let i = 0; i < data.length; i += 4) {
        grayscale[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      const gx = new Float32Array(width * height);
      const gy = new Float32Array(width * height);
      const mag = new Float32Array(width * height);

      // Sobel Kernels
      const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let sx = 0, sy = 0;
          for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
              const val = grayscale[(y + i) * width + (x + j)];
              sx += val * kx[(i + 1) * 3 + (j + 1)];
              sy += val * ky[(i + 1) * 3 + (j + 1)];
            }
          }
          gx[y * width + x] = sx;
          gy[y * width + x] = sy;
          mag[y * width + x] = Math.sqrt(sx * sx + sy * sy);
        }
      }

      // Final thresholding to produce edge map
      for (let i = 0; i < data.length; i += 4) {
        const val = mag[i / 4] > 50 ? 255 : 0;
        data[i] = data[i+1] = data[i+2] = val;
        data[i+3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = base64Image;
  });
};

/**
 * Applies a median filter for noise reduction.
 */
export const noiseReduction = async (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas ctx null'));
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      const output = ctx.createImageData(width, height);
      const outData = output.data;

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          for (let c = 0; c < 3; c++) {
            const vals = [];
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                vals.push(data[((y + ky) * width + (x + kx)) * 4 + c]);
              }
            }
            vals.sort((a, b) => a - b);
            outData[(y * width + x) * 4 + c] = vals[4]; // Median
          }
          outData[(y * width + x) * 4 + 3] = 255;
        }
      }
      ctx.putImageData(output, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = base64Image;
  });
};

/**
 * Applies adaptive thresholding based on local mean intensity.
 */
export const adaptiveThresholding = async (base64Image: string, windowSize = 15, offset = 10): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas ctx null'));
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      const grayscale = new Uint8ClampedArray(width * height);

      // 1. Grayscale
      for (let i = 0; i < data.length; i += 4) {
        grayscale[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      // 2. Adaptive Threshold
      const half = Math.floor(windowSize / 2);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let sum = 0;
          let count = 0;
          for (let wy = -half; wy <= half; wy++) {
            for (let wx = -half; wx <= half; wx++) {
              const ny = y + wy;
              const nx = x + wx;
              if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                sum += grayscale[ny * width + nx];
                count++;
              }
            }
          }
          const mean = sum / count;
          const val = grayscale[y * width + x] > (mean - offset) ? 255 : 0;
          const idx = (y * width + x) * 4;
          data[idx] = data[idx+1] = data[idx+2] = val;
          data[idx+3] = 255;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = base64Image;
  });
};

/**
 * Detects if an image is blurry using the Variance of Laplacian method.
 * Returns a score where lower values indicate more blur.
 * Typical threshold for "blurry" is < 100-500 depending on resolution.
 */
export const calculateBlurScore = async (base64Image: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas ctx null'));
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      
      const grayscale = new Float32Array(width * height);
      for (let i = 0; i < data.length; i += 4) {
        grayscale[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      // Laplacian Kernel
      const laplacian = [
        0,  1, 0,
        1, -4, 1,
        0,  1, 0
      ];

      let sum = 0;
      let count = 0;
      const scores: number[] = [];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let lapVal = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              lapVal += grayscale[(y + ky) * width + (x + kx)] * laplacian[(ky + 1) * 3 + (kx + 1)];
            }
          }
          scores.push(lapVal);
          sum += lapVal;
          count++;
        }
      }

      const mean = sum / count;
      let varianceSum = 0;
      for (const s of scores) {
        varianceSum += Math.pow(s - mean, 2);
      }

      resolve(varianceSum / count);
    };
    img.onerror = reject;
    img.src = base64Image;
  });
};

/**
 * Binarizes an image (Black & White) to improve OCR character recognition.
 * @param base64Image The source image in base64 format.
 * @returns A promise that resolves to the binarized base64 image.
 */
export const binarizeImage = async (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert to grayscale and apply threshold
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale using luminance formula
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Simple thresholding (can be improved with Otsu's if needed)
        const threshold = 128;
        const binary = gray > threshold ? 255 : 0;
        
        data[i] = binary;     // R
        data[i + 1] = binary; // G
        data[i + 2] = binary; // B
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.5));
    };
    img.onerror = reject;
    img.src = base64Image;
  });
};
