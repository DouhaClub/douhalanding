function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem.'));
    reader.readAsDataURL(file);
  });
}

function estimateDataUrlBytes(dataUrl) {
  const value = String(dataUrl || '');
  const marker = 'base64,';
  const idx = value.indexOf(marker);
  if (idx < 0) return value.length;
  const base64 = value.slice(idx + marker.length);
  return Math.floor((base64.length * 3) / 4);
}

function compressDataUrlImage(dataUrl, { maxWidth = 2560, quality = 0.92, format = 'jpeg' } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Falha ao preparar exportação da imagem.'));
        return;
      }
      if (format === 'png') {
        ctx.clearRect(0, 0, width, height);
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = format === 'png'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => reject(new Error('Falha ao processar a imagem.'));
    img.src = String(dataUrl);
  });
}

export function formatImageBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 2 : 1)} MB`;
}

export function formatImageSizeDelta(beforeBytes, afterBytes) {
  return `${formatImageBytes(beforeBytes)} → ${formatImageBytes(afterBytes)}`;
}

/**
 * Exporta imagem para upload (resize + JPEG/PNG alta qualidade).
 * @returns {{ file: File, beforeBytes: number, afterBytes: number }}
 */
export async function exportImageFile(file, preset) {
  if (!file) throw new Error('Arquivo de imagem inválido.');
  const {
    maxWidth = 2560,
    quality = 0.92,
    format = 'jpeg',
  } = preset || {};

  const beforeBytes = file.size || 0;
  const rawDataUrl = await readFileAsDataUrl(file);
  if (typeof rawDataUrl !== 'string') throw new Error('Arquivo inválido.');

  const exportedDataUrl = await compressDataUrlImage(rawDataUrl, { maxWidth, quality, format });
  const afterBytes = estimateDataUrlBytes(exportedDataUrl);
  const blob = await (await fetch(String(exportedDataUrl))).blob();
  const usePng = format === 'png';
  const safeName = String(file.name || 'image.jpg');
  const fileName = usePng
    ? safeName.replace(/\.(jpe?g|webp)$/i, '.png') || 'image.png'
    : safeName.replace(/\.(png|webp)$/i, '.jpg') || 'image.jpg';

  const exportedFile = new File([blob], fileName, {
    type: usePng ? 'image/png' : 'image/jpeg',
  });

  return {
    file: exportedFile,
    beforeBytes: beforeBytes || estimateDataUrlBytes(rawDataUrl),
    afterBytes: exportedFile.size || afterBytes,
  };
}

/** Exporta a partir de data URL (galeria/role salvam rascunho como data:). */
export async function exportDataUrlToFile(dataUrl, fileName, preset) {
  const blob = await (await fetch(String(dataUrl))).blob();
  const file = new File([blob], fileName || 'image.jpg', {
    type: blob.type || 'image/jpeg',
  });
  return exportImageFile(file, preset);
}
