import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BoutiquesModule } from './boutiques/boutiques.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { StockModule } from './stock/stock.module';
import { StockRequestsModule } from './stock-requests/stock-requests.module';
import { NetworkModule } from './network/network.module';
import { EmployeesModule } from './employees/employees.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { FeedModule } from './feed/feed.module';
import { OrdersModule } from './orders/orders.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { ConfigEndpointModule } from './config-endpoint/config-endpoint.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    CommonModule,
    AuthModule,
    UsersModule,
    BoutiquesModule,
    ProductsModule,
    SalesModule,
    StockModule,
    StockRequestsModule,
    NetworkModule,
    EmployeesModule,
    MarketplaceModule,
    FeedModule,
    OrdersModule,
    NotificationsModule,
    AdminModule,
    ConfigEndpointModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
