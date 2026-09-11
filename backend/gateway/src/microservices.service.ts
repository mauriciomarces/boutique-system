import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MicroservicesService {
  constructor(private readonly httpService: HttpService) {}

  async get(url: string): Promise<unknown> {
    try {
      const response = await firstValueFrom(this.httpService.get<unknown>(url));

      return response.data;
    } catch (error) {
      console.error(`Error al comunicarse con ${url}:`, error);

      throw new ServiceUnavailableException(
        'El microservicio solicitado no está disponible',
      );
    }
  }
}
