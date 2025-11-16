import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MagicByteFileValidator } from '../../common/validators/magic-byte-file.validator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { VendorType, VendorCriticality } from '@prisma/client';

@ApiTags('vendors')
@ApiBearerAuth('JWT-auth')
@Controller('vendors')
@UseGuards(JwtAuthGuard)
export class VendorsController {
  constructor(private vendorsService: VendorsService) {}

  @Get()
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
  @ApiOperation({ summary: 'Get all vendors', description: 'Returns all vendors for the authenticated user\'s tenant with optional filtering' })
  @ApiQuery({ name: 'type', required: false, enum: VendorType, description: 'Filter by vendor type' })
  @ApiQuery({ name: 'criticality', required: false, enum: VendorCriticality, description: 'Filter by criticality level' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search vendors by name' })
  @ApiQuery({ name: 'includeFacts', required: false, type: String, description: 'Include extracted facts (true/false)' })
  @ApiResponse({ status: 200, description: 'List of vendors' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('type') type?: VendorType,
    @Query('criticality') criticality?: VendorCriticality,
    @Query('search') search?: string,
    @Query('includeFacts') includeFacts?: string,
  ) {
    return this.vendorsService.findAll(user.tenantId, {
      type,
      criticality,
      search,
      includeFacts: includeFacts === 'true',
    });
  }

  @Get(':id')
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
  @ApiOperation({ summary: 'Get vendor by ID', description: 'Returns a single vendor with all related data' })
  @ApiParam({ name: 'id', type: String, description: 'Vendor UUID' })
  @ApiResponse({ status: 200, description: 'Vendor details' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.vendorsService.findOne(id, user.tenantId);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  @ApiOperation({ summary: 'Create vendor', description: 'Creates a new vendor for the authenticated user\'s tenant' })
  @ApiResponse({ status: 201, description: 'Vendor created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async create(@Body() dto: CreateVendorDto, @CurrentUser() user: CurrentUserData) {
    return this.vendorsService.create(user.tenantId, dto, user.userId);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 50, ttl: 60000 } }) // 50 requests per minute
  @ApiOperation({ summary: 'Update vendor', description: 'Updates an existing vendor' })
  @ApiParam({ name: 'id', type: String, description: 'Vendor UUID' })
  @ApiResponse({ status: 200, description: 'Vendor updated successfully' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.vendorsService.update(id, user.tenantId, dto, user.userId);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute (destructive operation)
  @ApiOperation({ summary: 'Delete vendor', description: 'Permanently deletes a vendor and all related data' })
  @ApiParam({ name: 'id', type: String, description: 'Vendor UUID' })
  @ApiResponse({ status: 200, description: 'Vendor deleted successfully' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async delete(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.vendorsService.delete(id, user.tenantId, user.userId);
  }

  @Post(':id/documents')
  @ApiOperation({ summary: 'Upload document', description: 'Upload a vendor document (PDF, DOC, DOCX, TXT, CSV, XLS, XLSX). Max 10MB. Triggers automatic fact extraction.' })
  @ApiParam({ name: 'id', type: String, description: 'Vendor UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or file type' })
  @ApiResponse({ status: 413, description: 'File too large (max 10MB)' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (10 uploads/min)' })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 uploads per minute
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB (reduced from 50MB)
          new MagicByteFileValidator({
            allowedMimeTypes: [
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'text/plain',
              'text/csv',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ],
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.vendorsService.uploadDocument(id, user.tenantId, user.userId, file, dto);
  }

  @Post(':id/extract')
  @ApiOperation({ summary: 'Trigger AI extraction', description: 'Manually trigger AI-powered fact extraction for a vendor. Requires uploaded documents. Returns extraction job.' })
  @ApiParam({ name: 'id', type: String, description: 'Vendor UUID' })
  @ApiResponse({ status: 201, description: 'Extraction job created successfully' })
  @ApiResponse({ status: 400, description: 'No documents uploaded' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (5 extractions/min)' })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 extractions per minute
  async triggerExtraction(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.vendorsService.triggerExtraction(id, user.tenantId, user.userId);
  }

  @Get(':id/sources')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  @ApiOperation({ summary: 'Get supporting sources', description: 'Get document snippets that support a specific extracted fact' })
  @ApiParam({ name: 'id', type: String, description: 'Vendor UUID' })
  @ApiQuery({ name: 'statement', type: String, description: 'The fact/statement to find sources for' })
  @ApiResponse({ status: 200, description: 'Supporting sources retrieved' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getSupportingSnippets(
    @Param('id') id: string,
    @Query('statement') statement: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!statement || statement.trim() === '') {
      throw new BadRequestException('statement query parameter is required and cannot be empty');
    }
    return this.vendorsService.getSupportingSnippets(id, user.tenantId, statement);
  }
}
