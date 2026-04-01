/**
 * Image utility functions for client-side compression and conversion.
 * All functions run in the browser (no Node.js dependencies).
 */

/**
 * Compress an image file using an offscreen canvas.
 * Resizes so that the longest dimension does not exceed maxWidth,
 * then encodes as JPEG at the given quality.
 */
export function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.8,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { naturalWidth: origW, naturalHeight: origH } = img;

      // Compute scaled dimensions, preserving aspect ratio.
      let targetW = origW;
      let targetH = origH;
      if (origW > maxWidth) {
        targetW = maxWidth;
        targetH = Math.round((origH * maxWidth) / origW);
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get 2D canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob returned null"));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = objectUrl;
  });
}

/**
 * Convert a Blob/File to a base64 data URL.
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("FileReader result is not a string"));
      }
    };
    reader.onerror = () =>
      reject(new Error("FileReader failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert a base64 data URL back to a Blob.
 * Throws if the data URL is malformed.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  if (!header || !base64) {
    throw new Error("Invalid data URL: missing header or data");
  }

  const mimeMatch = header.match(/:(.*?);/);
  if (!mimeMatch) {
    throw new Error("Invalid data URL: could not extract MIME type");
  }
  const mime = mimeMatch[1];

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}
