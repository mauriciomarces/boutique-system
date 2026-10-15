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
});
