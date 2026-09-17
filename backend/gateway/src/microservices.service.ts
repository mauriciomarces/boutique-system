import {
  Injectable,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig, Method } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MicroservicesService {
  constructor(private readonly httpService: HttpService) {}

  async request(
    method: Method,
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<unknown> {
    try {
      const config: AxiosRequestConfig = {
        method,
        url,
        headers: {
          'Content-Type': 'application/json',
          ...(headers || {}),
        },
        data: body,
        validateStatus: () => true,
      };

      const response = await firstValueFrom(
        this.httpService.request<unknown>(config),
      );

      if (response.status >= 400) {
        throw new HttpException(
          response.data || {
            error: 'Error en el microservicio solicitado',
          },
          response.status,
        );
      }

      return response.data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error(`Error al comunicarse con ${url}:`, error);

      throw new ServiceUnavailableException(
        'El microservicio solicitado no está disponible',
      );
    }
  }

  async get(
    url: string,
    headers?: Record<string, string>,
  ): Promise<unknown> {
    return this.request('GET', url, undefined, headers);
  }

  async post(
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<unknown> {
    return this.request('POST', url, body, headers);
  }

  async put(
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<unknown> {
    return this.request('PUT', url, body, headers);
  }

  async patch(
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<unknown> {
    return this.request('PATCH', url, body, headers);
  }

  async delete(
    url: string,
    headers?: Record<string, string>,
  ): Promise<unknown> {
    return this.request('DELETE', url, undefined, headers);
  }
}