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
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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
  ) {
    return this.vendorsService.findAll(user.tenantId, {
      type,
      criticality,
      search,
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
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FileTypeValidator({ fileType: /(pdf|doc|docx|txt|csv|xlsx)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.vendorsService.uploadDocument(id, user.tenantId, user.userId, file, dto);
  }
}
