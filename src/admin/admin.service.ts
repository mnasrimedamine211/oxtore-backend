import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';

export interface AdminStat {
  key: string;
  label: string;
  value: string;
  icon: string;
  colorClass: string;
  trend: string;
  trendColorClass: string;
}

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats(): Promise<AdminStat[]> {
    const [
      totalUsers,
      totalBoutiques,
      totalProducts,
      totalSales,
      totalOrders,
      totalRevenueAgg,
      activeBoutiques,
      pendingBoutiques,
    ] = await Promise.all([
      this.prisma.profile.count({ where: { deletedAt: null } }),
      this.prisma.boutique.count({ where: { deletedAt: null } }),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.sale.count({ where: { deletedAt: null, status: 'completed' } }),
      this.prisma.order.count({ where: { deletedAt: null } }),
      this.prisma.sale.aggregate({
        where: { deletedAt: null, status: 'completed' },
        _sum: { total: true },
      }),
      this.prisma.boutique.count({ where: { deletedAt: null, status: 'active' } }),
      this.prisma.boutique.count({ where: { deletedAt: null, status: 'pending' } }),
    ]);

    const totalRevenue = Number(totalRevenueAgg._sum.total || 0);

    const makeStat = (
      key: string,
      label: string,
      value: number,
      icon: string,
    ): AdminStat => ({
      key,
      label,
      value: value.toLocaleString(),
      icon,
      colorClass: 'text-primary',
      trend: '+0%',
      trendColorClass: 'text-neutral',
    });

    return [
      makeStat('totalUsers', 'Total Users', totalUsers, 'people'),
      makeStat('totalBoutiques', 'Total Boutiques', totalBoutiques, 'storefront'),
      makeStat('totalProducts', 'Total Products', totalProducts, 'cube'),
      makeStat('totalSales', 'Total Sales', totalSales, 'cart'),
      makeStat('totalOrders', 'Total Orders', totalOrders, 'receipt'),
      makeStat('totalRevenue', 'Total Revenue', totalRevenue, 'cash'),
      makeStat('activeBoutiques', 'Active Boutiques', activeBoutiques, 'checkmark-circle'),
      makeStat('pendingBoutiques', 'Pending Boutiques', pendingBoutiques, 'time'),
    ];
  }

  async getRecentActivity(limit = 10) {
    const [recentSales, recentOrders, recentUsers] = await Promise.all([
      this.prisma.sale.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        where: { deletedAt: null },
        include: { boutique: { select: { name: true } } },
      }),
      this.prisma.order.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        where: { deletedAt: null },
      }),
      this.prisma.profile.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        where: { deletedAt: null },
        select: { id: true, fullName: true, email: true, createdAt: true },
      }),
    ]);

    return {
      recentSales,
      recentOrders,
      recentUsers,
    };
  }

  async getBoutiques(query: PaginationDto & { status?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;

    const [boutiques, total] = await Promise.all([
      this.prisma.boutique.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          manager: { select: { id: true, fullName: true, email: true } },
          _count: { select: { products: true, employees: true, owners: true } },
        },
      }),
      this.prisma.boutique.count({ where }),
    ]);

    return {
      data: boutiques,
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

  async approveBoutique(id: string) {
    return this.prisma.boutique.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  async suspendBoutique(id: string) {
    return this.prisma.boutique.update({
      where: { id },
      data: { status: 'suspended' },
    });
  }

  async getUsers(query: PaginationDto & { role?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.role) where.role = query.role;
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.profile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          isVerified: true,
          createdAt: true,
          activeBoutique: { select: { id: true, name: true } },
        },
      }),
      this.prisma.profile.count({ where }),
    ]);

    return {
      data: users,
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
}
