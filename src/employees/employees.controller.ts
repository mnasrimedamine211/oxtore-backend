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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: 'Add an employee to a boutique' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List employees for a boutique' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('boutiqueId') boutiqueId: string,
    @Query() query: PaginationDto,
  ) {
    return this.employeesService.findAll(user.sub, boutiqueId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee by ID' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.employeesService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update employee' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete employee' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.employeesService.remove(user.sub, id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get employee sales statistics' })
  getStats(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.employeesService.getStats(user.sub, id);
  }
}
