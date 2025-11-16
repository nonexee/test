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
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MagicByteFileValidator } from '../../common/validators/magic-byte-file.validator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { VendorType, VendorCriticality } from '@prisma/client';

@Controller('vendors')
@UseGuards(JwtAuthGuard)
export class VendorsController {
  constructor(private vendorsService: VendorsService) {}

  @Get()
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
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.vendorsService.findOne(id, user.tenantId);
  }

  @Post()
  async create(@Body() dto: CreateVendorDto, @CurrentUser() user: CurrentUserData) {
    return this.vendorsService.create(user.tenantId, dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.vendorsService.update(id, user.tenantId, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.vendorsService.delete(id, user.tenantId);
  }

  @Post(':id/documents')
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
  async triggerExtraction(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.vendorsService.triggerExtraction(id, user.tenantId);
  }

  @Get(':id/sources')
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
