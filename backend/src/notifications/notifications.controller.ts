import { Controller, Get, Patch, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('notifications')
@UseGuards(JwtAuthGuard, MustChangePasswordGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getNotifications(user.sub);
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    try {
      return await this.notificationsService.markAsRead(user.sub, id);
    } catch (e) {
      throw new NotFoundException('Notification not found');
    }
  }
}
