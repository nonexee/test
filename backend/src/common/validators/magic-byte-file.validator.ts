import { FileValidator } from '@nestjs/common';

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

    // Import file-type dynamically to check magic bytes
    const { fileTypeFromBuffer } = await import('file-type');
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
