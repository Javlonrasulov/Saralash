import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator.js';
import { PutAppStateDto } from './dto.js';
import { AppStateService } from './app-state.service.js';

@ApiTags('app-state')
@ApiBearerAuth()
@Controller('app-state')
export class AppStateController {
  constructor(private readonly service: AppStateService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Put()
  put(@CurrentUser() user: CurrentUserPayload, @Body() dto: PutAppStateDto) {
    return this.service.put(user.sub, dto.payload);
  }
}
