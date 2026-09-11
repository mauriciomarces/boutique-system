import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { MicroservicesService } from './microservices.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly microservicesService: MicroservicesService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api/users')
  getUsers() {
    return this.microservicesService.get('http://users-service:4002/usuarios');
  }

  @Get('api/products')
  getProducts() {
    return this.microservicesService.get(
      'http://products-service:4003/productos',
    );
  }

  @Get('api/inventory')
  getInventory() {
    return this.microservicesService.get(
      'http://inventory-service:4004/existencias',
    );
  }

  @Get('api/sales')
  getSales() {
    return this.microservicesService.get('http://sales-service:4005/ventas');
  }

  @Get('api/notifications')
  getNotifications() {
    return this.microservicesService.get(
      'http://notifications-service:4006/notificaciones',
    );
  }
}
