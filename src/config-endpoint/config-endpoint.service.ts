import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ConfigEndpointService {
  constructor(private prisma: PrismaService) {}

  async getCurrencies() {
    return this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  async getCountries() {
    return this.prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getConfig() {
    const [currencies, countries] = await Promise.all([
      this.getCurrencies(),
      this.getCountries(),
    ]);
    return { currencies, countries };
  }
}
