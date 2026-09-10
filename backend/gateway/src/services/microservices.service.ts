import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MicroservicesService {
  constructor(private readonly httpService: HttpService) {}

  async getServiceHealth(serviceUrl: string) {
    const response = await firstValueFrom(
      this.httpService.get(`${serviceUrl}/health`),
    );

    return response.data;
  }
}