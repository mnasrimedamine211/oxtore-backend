import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateEmployeeDto) {
    await this.checkBoutiqueAccess(userId, dto.boutiqueId);

    const existing = await this.prisma.employee.findFirst({
      where: { email: dto.email, boutiqueId: dto.boutiqueId, deletedAt: null },
    });
    if (existing) throw new ConflictException('Employee already exists in this boutique');

    const employee = await this.prisma.employee.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        avatar: dto.avatar,
        role: (dto.role as any) || 'SELLER',
        boutiqueId: dto.boutiqueId,
        status: 'pending',
      },
    });

    // Notify boutique managers/owners
    await this.notifyBoutiqueManagers(dto.boutiqueId, 'employee', 'New Employee Added', `${dto.fullName} has been added`);

    return employee;
  }

  async findAll(userId: string, boutiqueId: string, query: PaginationDto) {
    await this.checkBoutiqueAccess(userId, boutiqueId);

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
        include: { _count: { select: { sales: true } } },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data: employees,
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
    await this.checkBoutiqueAccess(userId, employee.boutiqueId);
    return employee;
  }

  async update(userId: string, id: string, dto: UpdateEmployeeDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    await this.checkBoutiqueAccess(userId, employee.boutiqueId);

    return this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
        ...(dto.role && { role: dto.role as any }),
        ...(dto.status && { status: dto.status as any }),
      },
    });
  }

  async remove(userId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    await this.checkBoutiqueAccess(userId, employee.boutiqueId);

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

  private async checkBoutiqueAccess(userId: string, boutiqueId: string) {
    const boutique = await this.prisma.boutique.findFirst({
      where: {
        id: boutiqueId,
        deletedAt: null,
        OR: [
          { managerId: userId },
          { owners: { some: { userId } } },
        ],
      },
    });
    if (!boutique) throw new ForbiddenException('Access denied to this boutique');
  }

  private async notifyBoutiqueManagers(boutiqueId: string, type: string, title: string, message: string) {
    const boutique = await this.prisma.boutique.findUnique({
      where: { id: boutiqueId },
      include: { owners: true },
    });
    if (!boutique) return;

    const userIds = new Set<string>();
    if (boutique.managerId) userIds.add(boutique.managerId);
    boutique.owners.forEach((o) => userIds.add(o.userId));

    for (const uid of userIds) {
      await this.prisma.notification.create({
        data: {
          userId: uid,
          type: type as any,
          title,
          message,
          data: { boutiqueId },
        },
      });
    }
  }
}
