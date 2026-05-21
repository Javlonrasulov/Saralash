import { Module } from '@nestjs/common';
import { AppStateController } from './app-state.controller.js';
import { AppStateService } from './app-state.service.js';

@Module({
  controllers: [AppStateController],
  providers: [AppStateService],
})
export class AppStateModule {}
