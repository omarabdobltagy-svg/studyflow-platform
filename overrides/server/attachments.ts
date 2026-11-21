const MIME_TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "text/plain": "text",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;

export type SupportedAttachmentMime = keyof typeof MIME_TYPES;

export function isSupportedAttachmentMime(value: string): value is SupportedAttachmentMime {
  return Object.prototype.hasOwnProperty.call(MIME_TYPES, value);
}

export function decodeAndValidateAttachment(contentBase64: string, mimeType: string) {
  if (!(mimeType in MIME_TYPES)) {
    throw new Error("نوع الملف غير مدعوم. الأنواع المتاحة: PDF وDOCX وTXT وصور JPG وPNG وWebP.");
  }
  if (!contentBase64 || !contentBase64.trim()) {
    throw new Error("تعذّر قراءة الملف المرفوع. أعد اختياره وحاول مرة أخرى.");
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64)) {
    throw new Error("تعذّر قراءة الملف المرفوع. أعد اختياره وحاول مرة أخرى.");
  }

  const binary = Buffer.from(contentBase64, "base64");
  if (!binary.length || binary.length > 8 * 1024 * 1024) {
    throw new Error("حجم الملف يجب أن يكون أكبر من صفر وألا يتجاوز 8 ميغابايت.");
  }

  const valid = (() => {
    switch (mimeType as SupportedAttachmentMime) {
      case "application/pdf":
        return binary.subarray(0, 5).toString("ascii") === "%PDF-";
      case "image/jpeg":
        return binary[0] === 0xff && binary[1] === 0xd8 && binary[2] === 0xff;
      case "image/png":
        return binary.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      case "image/webp":
        return binary.subarray(0, 4).toString("ascii") === "RIFF" && binary.subarray(8, 12).toString("ascii") === "WEBP";
      case "text/plain":
        if (binary.includes(0)) return false;
        try {
          new TextDecoder("utf-8", { fatal: true }).decode(binary);
          return true;
        } catch {
          return false;
        }
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return binary[0] === 0x50 && binary[1] === 0x4b && binary[2] === 0x03 && binary[3] === 0x04;
      default:
        return false;
    }
  })();

  if (!valid) throw new Error("محتوى الملف لا يطابق نوعه المعلن. لم يتم رفعه.");
  return binary;
}
