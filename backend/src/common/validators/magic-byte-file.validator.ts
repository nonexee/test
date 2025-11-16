import { FileValidator } from '@nestjs/common';
import type { FileTypeResult } from 'file-type';

// Cache the file-type import to avoid repeated dynamic imports
let fileTypeFromBufferCache: ((buffer: Uint8Array | ArrayBuffer) => Promise<FileTypeResult | undefined>) | null = null;

async function getFileTypeFromBuffer() {
  if (!fileTypeFromBufferCache) {
    const { fileTypeFromBuffer } = await import('file-type');
    fileTypeFromBufferCache = fileTypeFromBuffer;
  }
  return fileTypeFromBufferCache;
}

export class MagicByteFileValidator extends FileValidator {
  private allowedTypes: string[];

  constructor(options: { allowedMimeTypes: string[] }) {
    super(options);
    this.allowedTypes = options.allowedMimeTypes;
  }

  async isValid(file?: Express.Multer.File): Promise<boolean> {
    if (!file || !file.buffer) {
      return false;
    }

    // Use cached file-type import to check magic bytes
    const fileTypeFromBuffer = await getFileTypeFromBuffer();
    const fileType = await fileTypeFromBuffer(file.buffer);

    if (!fileType) {
      // If we can't determine the type, reject for security
      return false;
    }

    // Check if the detected MIME type is in the allowed list
    return this.allowedTypes.includes(fileType.mime);
  }

  buildErrorMessage(): string {
    return `File type must be one of: ${this.allowedTypes.join(', ')}`;
  }
}
