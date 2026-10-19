import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  BadGatewayException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';

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
  // INVENTARIO
  // =========================================================

  @Get('api/inventory')
  getInventory(
    @Query('stock_bajo') stockBajo?: string,
    @Query('variante_producto_id') varianteProductoId?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const params = new URLSearchParams();

    if (stockBajo) {
      params.set('stock_bajo', stockBajo);
    }

    if (varianteProductoId) {
      params.set('variante_producto_id', varianteProductoId);
    }

    const query = params.toString();

    return this.microservicesService.get(
      `http://inventory-service:4004/existencias${query ? `?${query}` : ''}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/inventory/movimientos')
  getInventoryMovements(
    @Query('variante_producto_id') varianteProductoId?: string,
    @Query('tipo_movimiento') tipoMovimiento?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const params = new URLSearchParams();

    if (varianteProductoId) {
      params.set('variante_producto_id', varianteProductoId);
    }

    if (tipoMovimiento) {
      params.set('tipo_movimiento', tipoMovimiento);
    }

    const query = params.toString();

    return this.microservicesService.get(
      `http://inventory-service:4004/movimientos${query ? `?${query}` : ''}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/inventory/:id')
  getInventoryItem(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.get(
      `http://inventory-service:4004/existencias/${id}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/inventory')
  createInventoryItem(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      'http://inventory-service:4004/existencias',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Put('api/inventory/:id')
  updateInventoryItem(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.put(
      `http://inventory-service:4004/existencias/${id}`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  // =========================================================
  // MOVIMIENTOS DE INVENTARIO
  // =========================================================

  @Post('api/inventory/movimientos')
  createInventoryMovement(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      'http://inventory-service:4004/movimientos',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  // =========================================================
  // PROVEEDORES
  // =========================================================

  @Get('api/proveedores')
  getProveedores(
    @Headers('authorization') authorization?: string,
    @Query('buscar') buscar?: string,
    @Query('estado') estado?: string,
  ) {
    const params = new URLSearchParams();

    if (buscar) {
      params.set('buscar', buscar);
    }

    if (estado) {
      params.set('estado', estado);
    }

    const query = params.toString();

    return this.microservicesService.get(
      `http://inventory-service:4004/proveedores${query ? `?${query}` : ''}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/proveedores/:id')
  getProveedor(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.get(
      `http://inventory-service:4004/proveedores/${id}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/proveedores')
  createProveedor(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      'http://inventory-service:4004/proveedores',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Put('api/proveedores/:id')
  updateProveedor(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.put(
      `http://inventory-service:4004/proveedores/${id}`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Patch('api/proveedores/:id/estado')
  changeProveedorStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.patch(
      `http://inventory-service:4004/proveedores/${id}/estado`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  // =========================================================
  // COMPRAS
  // =========================================================

  @Get('api/compras')
  getCompras(
    @Query('proveedor_id') proveedorId?: string,
    @Query('estado') estado?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const params = new URLSearchParams();

    if (proveedorId) {
      params.set('proveedor_id', proveedorId);
    }

    if (estado) {
      params.set('estado', estado);
    }

    const query = params.toString();

    return this.microservicesService.get(
      `http://inventory-service:4004/compras${query ? `?${query}` : ''}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/compras/:id')
  getCompra(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.get(
      `http://inventory-service:4004/compras/${id}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/compras')
  createCompra(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      'http://inventory-service:4004/compras',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Patch('api/compras/:id/anular')
  anularCompra(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.patch(
      `http://inventory-service:4004/compras/${id}/anular`,
      {},
      this.getForwardedHeaders(authorization),
    );
  }

  // =========================================================
  // VENTAS
  // =========================================================

  @Get('api/ventas')
  getVentas(@Headers('authorization') authorization?: string) {
    return this.microservicesService.get(
      'http://sales-service:4005/ventas',
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/ventas/:id')
  getVenta(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.get(
      `http://sales-service:4005/ventas/${id}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/ventas')
  createVenta(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      'http://sales-service:4005/ventas',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Patch('api/ventas/:id/estado')
  async changeVentaStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
    @Headers('authorization') authorization?: string,
  ) {
    const result = await this.microservicesService.patch(
      `http://sales-service:4005/ventas/${id}/estado`,
      body,
      this.getForwardedHeaders(authorization),
    );

    if (
      body &&
      typeof body === 'object' &&
      'estado' in body &&
      body.estado === 'ANULADA'
    ) {
      if (
        !result ||
        typeof result !== 'object' ||
        !('anulacion' in result) ||
        !result.anulacion ||
        typeof result.anulacion !== 'object' ||
        !('estado' in result.anulacion) ||
        typeof result.anulacion.estado !== 'string'
      ) {
        throw new BadGatewayException(
          'Sales-service devolvió una respuesta de anulación no válida',
        );
      }

      response.status(result.anulacion.estado === 'COMPLETADA' ? 200 : 202);
    }

    return result;
  }

  @Get('api/ventas/:id/anulacion')
  getVentaAnulacion(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.get(
      `http://sales-service:4005/ventas/${id}/anulacion`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/ventas/:id/anulacion/reintentar')
  @HttpCode(200)
  async retryVentaAnulacion(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.microservicesService.post(
      `http://sales-service:4005/ventas/${id}/anulacion/reintentar`,
      {},
      this.getForwardedHeaders(authorization),
    );
    if (
      !result ||
      typeof result !== 'object' ||
      !('estado' in result) ||
      typeof result.estado !== 'string'
    ) {
      throw new BadGatewayException(
        'Sales-service devolvió una respuesta de anulación no válida',
      );
    }

    response.status(result.estado === 'COMPLETADA' ? 200 : 202);
    return result;
  }

  // =========================================================
  // PAGOS
  // =========================================================

  @Get('api/pagos')
  getPagos(@Headers('authorization') authorization?: string) {
    return this.microservicesService.get(
      'http://sales-service:4005/pagos',
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/pagos')
  createPago(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      'http://sales-service:4005/pagos',
      body,
      this.getForwardedHeaders(authorization),
    );
  }
  @Get('api/clientes')
  getClientes(@Headers('authorization') authorization?: string) {
    return this.microservicesService.get(
      `http://sales-service:4005/clientes`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/clientes/:id')
  getCliente(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.get(
      `http://sales-service:4005/clientes/${id}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/clientes')
  createCliente(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      `http://sales-service:4005/clientes`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Put('api/clientes/:id')
  updateCliente(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.put(
      `http://sales-service:4005/clientes/${id}`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Patch('api/clientes/:id/estado')
  changeClienteStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.patch(
      `http://sales-service:4005/clientes/${id}/estado`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/correlation/health')
  correlationHealth(@Headers('authorization') authorization?: string) {
    return this.microservicesService.get(
      'http://logic-correlation-service:4007/health',
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/correlation/events')
  async listCorrelationEvents(
    @Query('usuario_id') usuarioId?: string,
    @Query('service') service?: string,
    @Query('tipo_evento') tipoEvento?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.requireAnalysisPermission(authorization);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({
      usuario_id: usuarioId,
      service,
      tipo_evento: tipoEvento,
      from,
      to,
      limit,
    })) {
      if (value) params.set(key, value);
    }
    return this.microservicesService.get(
      `http://logic-correlation-service:4007/events?${params.toString()}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/correlation/analyses')
  async listCorrelationAnalyses(@Headers('authorization') authorization?: string) {
    await this.requireAnalysisPermission(authorization);
    return this.microservicesService.get(
      'http://logic-correlation-service:4007/analyses',
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/correlation/events')
  async ingestCorrelationEvent(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    await this.requireAnalysisPermission(authorization);
    return this.microservicesService.post(
      'http://logic-correlation-service:4007/events',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/correlation/correlations/analyze')
  async analyzeCorrelation(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    await this.requireAnalysisPermission(authorization);
    return this.microservicesService.post(
      'http://logic-correlation-service:4007/correlations/analyze',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/correlation/features/generate')
  async generateCorrelationFeatures(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    await this.requireAnalysisPermission(authorization);
    return this.microservicesService.post(
      'http://logic-correlation-service:4007/features/generate',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/correlation/analyze-and-classify')
  async analyzeAndClassify(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    await this.requireAnalysisPermission(authorization);
    return this.microservicesService.post(
      'http://logic-correlation-service:4007/analyze-and-classify',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/ai/health')
  aiHealth(@Headers('authorization') authorization?: string) {
    return this.microservicesService.get(
      'http://ai-service:4008/health',
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/ai/train')
  async aiTrain(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    await this.requireAnalysisPermission(authorization);
    return this.microservicesService.post(
      'http://ai-service:4008/train',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/ai/predict')
  async aiPredict(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    await this.requireAnalysisPermission(authorization);
    return this.microservicesService.post(
      'http://ai-service:4008/predict',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/ai/training')
  async aiTrainingList(@Headers('authorization') authorization?: string) {
    await this.requireAnalysisPermission(authorization);
    return this.microservicesService.get(
      'http://ai-service:4008/training',
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/ai/training/:id')
  async aiTrainingDetail(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.requireAnalysisPermission(authorization);
    return this.microservicesService.get(
      `http://ai-service:4008/training/${id}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/ai/metrics')
  async aiMetrics(@Headers('authorization') authorization?: string) {
    await this.requireAnalysisPermission(authorization);
    return this.microservicesService.get(
      'http://ai-service:4008/metrics',
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/ai/model')
  async aiModel(@Headers('authorization') authorization?: string) {
    await this.requireAnalysisPermission(authorization);
    return this.microservicesService.get(
      'http://ai-service:4008/model',
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/notifications')
  getNotifications(@Headers('authorization') authorization?: string) {
    return this.microservicesService.get(
      'http://notifications-service:4006/notificaciones',
      this.getForwardedHeaders(authorization),
    );
  }

  @Patch('api/notifications/:id/read')
  markNotificationAsRead(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.patch(
      `http://notifications-service:4006/notificaciones/${id}/leida`,
      {},
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
  changeCategoriaStatus(@Param('id') id: string, @Body() body: unknown) {
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

  @Get('api/productos/variantes')
  getVariantes(
    @Query('producto_id') productoId?: string,
    @Query('buscar') buscar?: string,
    @Query('estado') estado?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const query = new URLSearchParams();
    if (productoId) query.set('producto_id', productoId);
    if (buscar) query.set('buscar', buscar);
    if (estado) query.set('estado', estado);
    const suffix = query.size ? `?${query.toString()}` : '';

    return this.microservicesService.get(
      `http://products-service:4003/variantes${suffix}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/productos/variantes/:id')
  getVariante(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.get(
      `http://products-service:4003/variantes/${id}`,
      this.getForwardedHeaders(authorization),
    );
  }

  @Post('api/productos/variantes')
  createVariante(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      'http://products-service:4003/variantes',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Put('api/productos/variantes/:id')
  updateVariante(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.put(
      `http://products-service:4003/variantes/${id}`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Patch('api/productos/variantes/:id/estado')
  changeVarianteStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.patch(
      `http://products-service:4003/variantes/${id}/estado`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Get('api/productos/:id')
  getProducto(@Param('id') id: string) {
    return this.microservicesService.get(
      `http://products-service:4003/productos/${id}`,
    );
  }

  @Post('api/productos')
  createProducto(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.post(
      'http://products-service:4003/productos',
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Put('api/productos/:id')
  updateProducto(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.put(
      `http://products-service:4003/productos/${id}`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }

  @Patch('api/productos/:id/estado')
  changeProductoStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    return this.microservicesService.patch(
      `http://products-service:4003/productos/${id}/estado`,
      body,
      this.getForwardedHeaders(authorization),
    );
  }
  // =========================================================
  // HELPERS
  // =========================================================

  private getForwardedHeaders(authorization?: string): Record<string, string> {
    if (!authorization) {
      return {};
    }

    return {
      Authorization: authorization,
    };
  }

  private async requireAnalysisPermission(authorization?: string): Promise<void> {
    if (!authorization) {
      throw new UnauthorizedException('Se requiere una sesión autenticada.');
    }
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    if (!secret) {
      throw new BadGatewayException('La autorización del servicio de usuarios no está configurada.');
    }

    let status: number;
    try {
      const response = await fetch('http://users-service:4002/internal/auth/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization,
          'x-internal-service-key': secret,
        },
        body: JSON.stringify({ permission: 'USUARIOS_LEER' }),
        signal: AbortSignal.timeout(3000),
      });
      status = response.status;
    } catch {
      throw new BadGatewayException('No se pudo validar el permiso de análisis.');
    }
    if (status === 401) {
      throw new UnauthorizedException('La sesión no es válida.');
    }
    if (status === 403) {
      throw new ForbiddenException('No tiene permiso para consultar análisis.');
    }
    if (status < 200 || status >= 300) {
      throw new BadGatewayException('No se pudo validar el permiso de análisis.');
    }
  }
}
