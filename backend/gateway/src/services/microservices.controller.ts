import { Controller, Get } from '@nestjs/common';
import { MicroservicesService } from './microservices.service';

@Controller('api')
export class MicroservicesController {
  constructor(
    private readonly microservicesService: MicroservicesService,
  ) {}

  @Get('users/health')
  getUsersHealth() {
    return this.microservicesService.getServiceHealth(
      process.env.USERS_SERVICE_URL || 'http://users-service:4002',
    );
  }

  @Get('products/health')
  getProductsHealth() {
    return this.microservicesService.getServiceHealth(
      process.env.PRODUCTS_SERVICE_URL || 'http://products-service:4003',
    );
  }

  @Get('inventory/health')
  getInventoryHealth() {
    return this.microservicesService.getServiceHealth(
      process.env.INVENTORY_SERVICE_URL || 'http://inventory-service:4004',
    );
  }

  @Get('sales/health')
  getSalesHealth() {
    return this.microservicesService.getServiceHealth(
      process.env.SALES_SERVICE_URL || 'http://sales-service:4005',
    );
  }

  @Get('notifications/health')
  getNotificationsHealth() {
    return this.microservicesService.getServiceHealth(
      process.env.NOTIFICATIONS_SERVICE_URL ||
        'http://notifications-service:4006',
    );
  }
}
