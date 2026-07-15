import {
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private parseQuery(query: QueryNotificationsDto) {
    return {
      ...query,
      isRead: query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined,
    };
  }

  private assertSelfOrAdmin(user: JwtPayload, userId: string) {
    if (user.sub !== userId && user.role !== 'ADMIN') {
      throw new ForbiddenException('You cannot access another user\'s notifications');
    }
  }

  @Get('notifications')
  @ApiOperation({ summary: 'List user notifications' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.findAll(user.sub, this.parseQuery(query));
  }

  @Get('notifications/unread/count')
  @ApiOperation({ summary: 'Get unread notification count' })
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getUnreadCount(user.sub);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.sub, id);
  }

  @Patch('notifications/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllAsRead(user.sub);
  }

  @Delete('notifications/:id')
  @ApiOperation({ summary: 'Delete notification' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notificationsService.remove(user.sub, id);
  }

  @Get('users/:userId/notifications')
  @ApiOperation({ summary: "List a specific user's notifications (self or admin)" })
  findAllForUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Query() query: QueryNotificationsDto,
  ) {
    this.assertSelfOrAdmin(user, userId);
    return this.notificationsService.findAll(userId, this.parseQuery(query));
  }

  @Patch('users/:userId/notifications/read-all')
  @ApiOperation({ summary: "Mark all of a specific user's notifications as read (self or admin)" })
  markAllAsReadForUser(@CurrentUser() user: JwtPayload, @Param('userId') userId: string) {
    this.assertSelfOrAdmin(user, userId);
    return this.notificationsService.markAllAsRead(userId);
  }
}
