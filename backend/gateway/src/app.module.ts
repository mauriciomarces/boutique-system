import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MicroservicesService } from './microservices.service';

@Module({
  imports: [HttpModule],
  controllers: [AppController],
  providers: [AppService, MicroservicesService],
})
export class AppModule {}
