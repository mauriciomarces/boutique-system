import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';

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

  // =========================================================
  // USERS
  // =========================================================

  @Get('api/users')
  getUsers(@Headers('authorization') authorization?: string) {
    return this.microservicesService.get(
      'http://users-service:4002/usuarios',
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/users/:id')
  getUser(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.get(
      `http://users-service:4002/usuarios/${id}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/users')
  createUser(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      'http://users-service:4002/usuarios',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Put('api/users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.put(
      `http://users-service:4002/usuarios/${id}`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Patch('api/users/:id/estado')
  changeUserStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.patch(
      `http://users-service:4002/usuarios/${id}/estado`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  // =========================================================
  // AUTHENTICATION
  // =========================================================

  @Post('api/users/auth/register')
  register(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://users-service:4002/auth/register',
      body,
    );
  }

  @Post('api/users/auth/verify-email')
  verifyEmail(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://users-service:4002/auth/verify-email',
      body,
    );
  }

  @Post('api/users/auth/resend-verification')
  resendVerification(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://users-service:4002/auth/resend-verification',
      body,
    );
  }

  @Post('api/users/auth/login')
  login(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://users-service:4002/auth/login',
      body,
    );
  }

  @Post('api/users/auth/refresh')
  refresh(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://users-service:4002/auth/refresh',
      body,
    );
  }

  @Post('api/users/auth/logout')
  logout(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      'http://users-service:4002/auth/logout',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/users/auth/me')
  me(@Headers('authorization') authorization?: string) {
    return this.microservicesService.get(
      'http://users-service:4002/auth/me',
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/users/auth/forgot-password')
  forgotPassword(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://users-service:4002/auth/forgot-password',
      body,
    );
  }

  @Post('api/users/auth/reset-password')
  resetPassword(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://users-service:4002/auth/reset-password',
      body,
    );
  }

  // =========================================================
  // OTHER MICROSERVICES
  // =========================================================

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
    return this.microservicesService.get(
      'http://sales-service:4005/ventas',
    );
  }

  @Get('api/notifications')
  getNotifications() {
    return this.microservicesService.get(
      'http://notifications-service:4006/notificaciones',
    );
  }

  // =========================================================
  // HELPERS
  // =========================================================

  private getForwardedHeaders(
    authorization?: string,
  ): Record<string, string> {
    if (!authorization) {
      return {};
    }

    return {
      Authorization: authorization,
    };
  }
}