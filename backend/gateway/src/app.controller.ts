import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
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

  @Post('api/users/:id/reenviar-activacion')
  resendActivation(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      `http://users-service:4002/usuarios/${id}/reenviar-activacion`,
      {},
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

  @Post('api/users/auth/activate-account')
  activateAccount(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://users-service:4002/auth/activate-account',
      body,
    );
  }

  // =========================================================
  // OTHER MICROSERVICES
  // =========================================================


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

  @Get('api/clientes')
  getClientes() {
    return this.microservicesService.get(
      'http://sales-service:4005/clientes',
    );
  }

  @Get('api/clientes/:id')
  getCliente(@Param('id') id: string) {
    return this.microservicesService.get(
      `http://sales-service:4005/clientes/${id}`,
    );
  }

  @Post('api/clientes')
  createCliente(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://sales-service:4005/clientes',
      body,
    );
  }

  @Put('api/clientes/:id')
  updateCliente(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.microservicesService.put(
      `http://sales-service:4005/clientes/${id}`,
      body,
    );
  }

  @Patch('api/clientes/:id/estado')
  changeClienteStatus(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.microservicesService.patch(
      `http://sales-service:4005/clientes/${id}/estado`,
      body,
    );
  }

  @Get('api/correlation/health')
  correlationHealth() {
    return this.microservicesService.get(
      'http://logic-correlation-service:4007/health',
    );
  }

  @Post('api/correlation/events')
  ingestCorrelationEvent(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://logic-correlation-service:4007/events',
      body,
    );
  }

  @Post('api/correlation/correlations/analyze')
  analyzeCorrelation(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://logic-correlation-service:4007/correlations/analyze',
      body,
    );
  }

  @Post('api/correlation/features/generate')
  generateCorrelationFeatures(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://logic-correlation-service:4007/features/generate',
      body,
    );
  }

  @Post('api/correlation/analyze-and-classify')
  analyzeAndClassify(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://logic-correlation-service:4007/analyze-and-classify',
      body,
    );
  }

  @Get('api/ai/health')
  aiHealth() {
    return this.microservicesService.get('http://ai-service:4008/health');
  }

  @Post('api/ai/train')
  aiTrain(@Body() body: unknown) {
    return this.microservicesService.post('http://ai-service:4008/train', body);
  }

  @Post('api/ai/predict')
  aiPredict(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://ai-service:4008/predict',
      body,
    );
  }

  @Get('api/ai/training')
  aiTrainingList() {
    return this.microservicesService.get('http://ai-service:4008/training');
  }

  @Get('api/ai/training/:id')
  aiTrainingDetail(@Param('id') id: string) {
    return this.microservicesService.get(
      `http://ai-service:4008/training/${id}`,
    );
  }

  @Get('api/ai/metrics')
  aiMetrics() {
    return this.microservicesService.get('http://ai-service:4008/metrics');
  }

  @Get('api/ai/model')
  aiModel() {
    return this.microservicesService.get('http://ai-service:4008/model');
  }

  @Get('api/notifications')
  getNotifications(@Headers('authorization') authorization?: string) {
    return this.microservicesService.get(
      'http://notifications-service:4006/notificaciones',
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/roles')
  getRoles(@Headers('authorization') authorization?: string) {
    return this.microservicesService.get(
      'http://users-service:4002/roles',
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/roles/:id')
  getRole(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.get(
      `http://users-service:4002/roles/${id}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/roles')
  createRole(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      'http://users-service:4002/roles',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Put('api/roles/:id')
  updateRole(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.put(
      `http://users-service:4002/roles/${id}`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Patch('api/roles/:id/estado')
  changeRoleStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.patch(
      `http://users-service:4002/roles/${id}/estado`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/permisos')
  getPermisos(@Headers('authorization') authorization?: string) {
    return this.microservicesService.get(
      'http://users-service:4002/permisos',
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/usuarios/:id/roles')
  getUserRoles(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.get(
      `http://users-service:4002/usuarios/${id}/roles`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/usuarios/:id/roles')
  assignUserRole(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      `http://users-service:4002/usuarios/${id}/roles`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Delete('api/usuarios/:id/roles/:rolId')
  removeUserRole(
    @Param('id') id: string,
    @Param('rolId') rolId: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.delete(
      `http://users-service:4002/usuarios/${id}/roles/${rolId}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/roles/:id/permisos')
  getRolePermissions(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.get(
      `http://users-service:4002/roles/${id}/permisos`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Delete('api/roles/:id/permisos/:permisoId')
  removeRolePermission(
    @Param('id') id: string,
    @Param('permisoId') permisoId: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.delete(
      `http://users-service:4002/roles/${id}/permisos/${permisoId}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/roles/:id/permisos')
  assignRolePermission(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      `http://users-service:4002/roles/${id}/permisos`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }
  // =========================================================
  // CATEGORIAS
  // =========================================================

  @Get('api/categorias')
  getCategorias(@Query('buscar') buscar?: string) {
    const query = buscar ? `?buscar=${encodeURIComponent(buscar)}` : '';

    return this.microservicesService.get(
      `http://products-service:4003/categorias${query}`,
    );
  }

  @Get('api/categorias/:id')
  getCategoria(@Param('id') id: string) {
    return this.microservicesService.get(
      `http://products-service:4003/categorias/${id}`,
    );
  }

  @Post('api/categorias')
  createCategoria(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://products-service:4003/categorias',
      body,
    );
  }

  @Put('api/categorias/:id')
  updateCategoria(@Param('id') id: string, @Body() body: unknown) {
    return this.microservicesService.put(
      `http://products-service:4003/categorias/${id}`,
      body,
    );
  }

  @Patch('api/categorias/:id/estado')
  changeCategoriaStatus(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.microservicesService.patch(
      `http://products-service:4003/categorias/${id}/estado`,
      body,
    );
  }

  // =========================================================
  // PRODUCTOS
  // =========================================================

  @Get('api/productos')
  getProductos(@Query('buscar') buscar?: string) {
    const query = buscar ? `?buscar=${encodeURIComponent(buscar)}` : '';

    return this.microservicesService.get(
      `http://products-service:4003/productos${query}`,
    );
  }

  @Get('api/productos/:id')
  getProducto(@Param('id') id: string) {
    return this.microservicesService.get(
      `http://products-service:4003/productos/${id}`,
    );
  }

  @Post('api/productos')
  createProducto(@Body() body: unknown) {
    return this.microservicesService.post(
      'http://products-service:4003/productos',
      body,
    );
  }

  @Put('api/productos/:id')
  updateProducto(@Param('id') id: string, @Body() body: unknown) {
    return this.microservicesService.put(
      `http://products-service:4003/productos/${id}`,
      body,
    );
  }

  @Patch('api/productos/:id/estado')
  changeProductoStatus(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.microservicesService.patch(
      `http://products-service:4003/productos/${id}/estado`,
      body,
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
