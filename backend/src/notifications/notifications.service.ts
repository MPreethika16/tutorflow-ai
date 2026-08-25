import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentResultPublishedEvent } from './events/assessment-result-published.event';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('assessment.result_published', { async: true })
  async handleAssessmentResultPublishedEvent(payload: AssessmentResultPublishedEvent) {
    try {
      await this.prisma.notification.create({
        data: {
          userId: payload.userId,
          type: NotificationType.RESULT_PUBLISHED,
          referenceId: payload.attemptId,
          title: 'Assessment Result Published',
          message: `Your result for '${payload.assessmentTitle}' is now available.`,
        },
      });
      this.logger.log(`Created notification for attempt ${payload.attemptId}`);
    } catch (error: any) {
      // Ignore unique constraint violation (P2002) because of idempotency
      if (error?.code === 'P2002') {
        this.logger.log(`Notification for attempt ${payload.attemptId} already exists. Skipping.`);
        return;
      }
      this.logger.error(`Failed to create notification for attempt ${payload.attemptId}: ${error.message}`);
    }
  }

  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    // Ensuring that users can only mark their own notifications as read
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });

    if (result.count === 0) {
      throw new Error('Notification not found or access denied');
    }

    return { success: true };
  }
}
