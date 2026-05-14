import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { SubmitFormDto } from './dto/submit-form.dto';

@ApiTags('Forms')
@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get('public/:id')
  @ApiOperation({ summary: 'Get a form template by ID for public submission' })
  getPublic(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }

  @Post('submit/:id')
  @ApiOperation({ summary: 'Submit form data' })
  submit(@Param('id') id: string, @Body() body: SubmitFormDto) {
    return this.formsService.submitForm(id, body.data);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'List all form templates' })
  findAll() {
    return this.formsService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR)
  @Post()
  @ApiOperation({ summary: 'Create a new form template (Director only)' })
  create(@Body() dto: CreateFormDto) {
    return this.formsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a form template (Director only)' })
  update(@Param('id') id: string, @Body() dto: CreateFormDto) {
    return this.formsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a form template (Director only)' })
  remove(@Param('id') id: string) {
    return this.formsService.remove(id);
  }
}
