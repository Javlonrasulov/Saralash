import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { ChangeCredentialsDto, LoginDto, RefreshDto } from './dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.identifier, dto.password);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
    return { ok: true };
  }

  @Get('me')
  @ApiBearerAuth()
  me(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.me(user.sub);
  }

  @Post('change-credentials')
  @ApiBearerAuth()
  changeCredentials(@CurrentUser() user: CurrentUserPayload, @Body() dto: ChangeCredentialsDto) {
    return this.authService.changeCredentials(user.sub, dto);
  }
}
