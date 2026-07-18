import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BoutiqueAccessService } from '../common/services/boutique-access.service';
import { BoutiqueNotifyService } from '../common/services/boutique-notify.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private boutiqueAccess: BoutiqueAccessService,
    private boutiqueNotify: BoutiqueNotifyService,
  ) {}

  async create(userId: string, boutiqueId: string, dto: CreateEmployeeDto) {
    await this.boutiqueAccess.assertAccess(userId, boutiqueId);

    const existing = await this.prisma.employee.findFirst({
      where: { email: dto.email, boutiqueId, deletedAt: null },
    });
    if (existing) throw new ConflictException('Employee already exists in this boutique');

    const employee = await this.prisma.employee.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        avatar: dto.avatar,
        role: (dto.role as any) || 'SELLER',
        boutiqueId,
        status: 'pending',
      },
      include: { boutique: true },
    });

    // Notify boutique managers/owners
    await this.boutiqueNotify.notifyManagers(boutiqueId, 'employee', 'New Employee Added', `${dto.fullName} has been added`);

    return this.formatEmployee(employee);
  }

  async findAll(userId: string, boutiqueId: string, query: PaginationDto) {
    await this.boutiqueAccess.assertAccess(userId, boutiqueId);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { boutiqueId, deletedAt: null };
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }
    if ((query as any).status) where.status = (query as any).status;
    if ((query as any).role) where.role = (query as any).role;

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { boutique: true, _count: { select: { sales: true } } },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data: employees.map((e) => this.formatEmployee(e)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(userId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: { boutique: true, _count: { select: { sales: true } } },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    await this.boutiqueAccess.assertAccess(userId, employee.boutiqueId);
    return this.formatEmployee(employee);
  }

  async update(userId: string, id: string, dto: UpdateEmployeeDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    await this.boutiqueAccess.assertAccess(userId, employee.boutiqueId);

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
        ...(dto.role && { role: dto.role as any }),
        ...(dto.status && { status: dto.status as any }),
      },
      include: { boutique: true },
    });
    return this.formatEmployee(updated);
  }

  async remove(userId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    await this.boutiqueAccess.assertAccess(userId, employee.boutiqueId);

    await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Employee removed successfully' };
  }

  async getStats(userId: string, id: string) {
    const employee = await this.findOne(userId, id);

    const sales = await this.prisma.sale.aggregate({
      where: { employeeId: id, deletedAt: null, status: 'completed' },
      _sum: { total: true },
      _count: true,
    });

    return {
      totalSales: sales._count,
      totalRevenue: sales._sum.total || 0,
      status: employee.status,
      role: employee.role,
    };
  }

  private formatEmployee(employee: any) {
    return {
      ...employee,
      boutiqueName: employee.boutique?.name ?? null,
    };
  }

}
