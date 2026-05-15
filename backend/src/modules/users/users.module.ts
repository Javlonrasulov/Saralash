import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, RolesGuard],
})
export class UsersModule {}
