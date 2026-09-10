import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MicroservicesController } from './services/microservices.controller';
import { MicroservicesService } from './services/microservices.service';

@Module({
  imports: [HttpModule],
  controllers: [AppController, MicroservicesController],
  providers: [AppService, MicroservicesService],
})
export class AppModule {}