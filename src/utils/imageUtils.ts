/**
 * Resizes an image to a maximum dimension while maintaining aspect ratio.
 * @param base64Image The source image in base64 format.
 * @param maxDimension The maximum width or height.
 * @returns A promise that resolves to the resized base64 image.
 */
export const resizeImage = async (base64Image: string, maxDimension = 1280): Promise<string> => {
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
      resolve(canvas.toDataURL('image/jpeg', 0.5));
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
