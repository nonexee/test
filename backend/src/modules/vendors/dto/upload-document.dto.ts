import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';

export class UploadDocumentDto {
  @ApiProperty({
    description: 'Type of document being uploaded',
    enum: DocumentType,
    example: 'CONTRACT',
  })
  @IsEnum(DocumentType)
  fileType: DocumentType;

  @ApiProperty({
    description: 'Document file (PDF, DOC, DOCX, TXT, CSV, XLS, XLSX)',
    type: 'string',
    format: 'binary',
  })
  file: any;
}
