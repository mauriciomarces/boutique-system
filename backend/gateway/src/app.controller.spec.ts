jest.mock('./microservices.service', () => ({
  MicroservicesService: class MicroservicesService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MicroservicesService } from './microservices.service';
import type { Response } from 'express';

describe('AppController', () => {
  let appController: AppController;
  let microservices: {
    get: jest.Mock;
    post: jest.Mock;
    patch: jest.Mock;
  };

  beforeEach(async () => {
    microservices = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
    };
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: MicroservicesService, useValue: microservices },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });

    describe('persistent sale cancellation proxy', () => {
      const response = () => {
        const status = jest.fn();
        return {
          outgoing: { status } as unknown as Response,
          status,
        };
      };

      it('forwards cancellation status as HTTP 202 while it is incomplete', async () => {
        const { outgoing, status } = response();
        microservices.patch.mockResolvedValue({
          venta: { id: '51', estado: 'CONFIRMADA' },
          anulacion: { estado: 'REINTENTABLE' },
        });

        await appController.changeVentaStatus(
          '51',
          { estado: 'ANULADA' },
          outgoing,
        );

        expect(status).toHaveBeenCalledWith(202);
      });

      it('preserves HTTP 200 when cancellation is completed', async () => {
        const { outgoing, status } = response();
        microservices.patch.mockResolvedValue({
          venta: { id: '51', estado: 'ANULADA' },
          anulacion: { estado: 'COMPLETADA' },
        });

        await appController.changeVentaStatus(
          '51',
          { estado: 'ANULADA' },
          outgoing,
        );

        expect(status).toHaveBeenCalledWith(200);
      });

      it('exposes the protected operation status route through sales-service', async () => {
        await appController.getVentaAnulacion('51');

        expect(microservices.get.mock.calls[0]).toEqual([
          'http://sales-service:4005/ventas/51/anulacion',
          {},
        ]);
      });

      it('preserves HTTP 202 for a reattempt that remains incomplete', async () => {
        const { outgoing, status } = response();
        microservices.post.mockResolvedValue({
          estado: 'REINTENTABLE',
          tareas: [],
        });

        await appController.retryVentaAnulacion('51', undefined, outgoing);

        expect(microservices.post.mock.calls[0]).toEqual([
          'http://sales-service:4005/ventas/51/anulacion/reintentar',
          {},
          {},
        ]);
        expect(status).toHaveBeenCalledWith(202);
      });
    });
  });

  describe('validación dinámica de autorización', () => {
    const originalFetch = global.fetch;
    const originalSecret = process.env.INTERNAL_SERVICE_SECRET;

    const mockResponse = (status: number, body: unknown) =>
      ({
        status,
        ok: status >= 200 && status < 300,
        json: jest.fn().mockResolvedValue(body),
      }) as unknown as globalThis.Response;

    beforeEach(() => {
      process.env.INTERNAL_SERVICE_SECRET = 'test-internal-secret';
    });

    afterEach(() => {
      global.fetch = originalFetch;

      if (originalSecret === undefined) {
        delete process.env.INTERNAL_SERVICE_SECRET;
      } else {
        process.env.INTERNAL_SERVICE_SECRET = originalSecret;
      }

      jest.restoreAllMocks();
    });

    describe('requireAnalysisPermission', () => {
      it('acepta una autorización válida', async () => {
        global.fetch = jest.fn().mockResolvedValue(
          mockResponse(200, {
            valid: true,
            user: { id: '10' },
            permission: 'USUARIOS_LEER',
          }),
        );

        await expect(
          (appController as any).requireAnalysisPermission('Bearer test-token'),
        ).resolves.toBeUndefined();
      });

      it('rechaza una respuesta 2xx sin valid true', async () => {
        global.fetch = jest.fn().mockResolvedValue(
          mockResponse(200, {
            valid: false,
            user: { id: '10' },
          }),
        );

        await expect(
          (appController as any).requireAnalysisPermission('Bearer test-token'),
        ).rejects.toThrow('La respuesta de autorización de análisis no es válida.');
      });

      it('rechaza una respuesta 2xx sin usuario válido', async () => {
        global.fetch = jest.fn().mockResolvedValue(
          mockResponse(200, {
            valid: true,
            user: { id: '0' },
          }),
        );

        await expect(
          (appController as any).requireAnalysisPermission('Bearer test-token'),
        ).rejects.toThrow('La respuesta de autorización de análisis no es válida.');
      });

      it('rechaza errores de comunicación', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('connection failed'));

        await expect(
          (appController as any).requireAnalysisPermission('Bearer test-token'),
        ).rejects.toThrow();
      });
    });

    describe('requireReportPermission', () => {
      it('acepta una autorización válida', async () => {
        global.fetch = jest.fn().mockResolvedValue(
          mockResponse(200, {
            valid: true,
            user: { id: '10' },
            permission: 'VENTAS_LEER',
          }),
        );

        await expect(
          (appController as any).requireReportPermission('Bearer test-token'),
        ).resolves.toBeUndefined();
      });

      it('rechaza una respuesta 2xx sin valid true', async () => {
        global.fetch = jest.fn().mockResolvedValue(
          mockResponse(200, {
            valid: false,
            user: { id: '10' },
          }),
        );

        await expect(
          (appController as any).requireReportPermission('Bearer test-token'),
        ).rejects.toThrow('La respuesta de autorización de reportes no es válida.');
      });

      it('rechaza una respuesta 2xx sin usuario válido', async () => {
        global.fetch = jest.fn().mockResolvedValue(
          mockResponse(200, {
            valid: true,
            user: {},
          }),
        );

        await expect(
          (appController as any).requireReportPermission('Bearer test-token'),
        ).rejects.toThrow('La respuesta de autorización de reportes no es válida.');
      });

      it('rechaza errores de comunicación', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('connection failed'));

        await expect(
          (appController as any).requireReportPermission('Bearer test-token'),
        ).rejects.toThrow();
      });
    });
  });
});
