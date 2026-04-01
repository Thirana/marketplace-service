import {
  Notification,
  NotificationStatus,
  NotificationType,
} from '../entities/notification.entity';
import { FirebaseNotificationGatewayService } from './firebase-notification-gateway.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const createPendingNotification = (): Notification =>
    ({
      id: '873938a8-8dd8-47f6-a90e-3fd8787652ea',
      orderId: '3f772c45-0dd2-4187-87ef-796922b8d147',
      type: NotificationType.ORDER_CREATED,
      status: NotificationStatus.PENDING,
      targetDeviceToken: 'fcm-registration-token-test-device-001',
      title: 'Order confirmed',
      body: 'Your order 3f772c45-0dd2-4187-87ef-796922b8d147 has been created successfully.',
      providerMessageId: null,
      failureReason: null,
      sentAt: null,
      failedAt: null,
      createdAt: new Date('2026-04-01T06:12:34.000Z'),
      updatedAt: new Date('2026-04-01T06:12:34.000Z'),
    }) as Notification;

  it('marks a notification as sent when Firebase delivery succeeds', async () => {
    const notificationsRepository = {
      findOneBy: (): Promise<Notification | null> =>
        Promise.resolve(createPendingNotification()),
      save: (notification: Notification): Promise<Notification> =>
        Promise.resolve(notification),
    };
    const saveSpy = jest.spyOn(notificationsRepository, 'save');
    const ordersRepository = {
      existsBy: (): Promise<boolean> => Promise.resolve(false),
    };
    const firebaseNotificationGateway = {
      send: (): Promise<string> =>
        Promise.resolve('projects/demo/messages/123'),
    };
    const sendSpy = jest.spyOn(firebaseNotificationGateway, 'send');
    const logger = {
      info: (entry: unknown): void => {
        void entry;
      },
      warn: (entry: unknown): void => {
        void entry;
      },
      error: (entry: unknown): void => {
        void entry;
      },
    };
    const infoSpy = jest.spyOn(logger, 'info');
    const service = new NotificationsService(
      notificationsRepository as never,
      ordersRepository as never,
      firebaseNotificationGateway as FirebaseNotificationGatewayService,
      logger as never,
    );

    await service.deliverPendingNotification(
      '873938a8-8dd8-47f6-a90e-3fd8787652ea',
    );

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '873938a8-8dd8-47f6-a90e-3fd8787652ea',
      }),
    );
    const firstSaveCall = saveSpy.mock.calls[0];

    if (!firstSaveCall) {
      throw new Error('Expected the notification to be persisted.');
    }

    const savedNotification = firstSaveCall[0];

    expect(savedNotification.status).toBe(NotificationStatus.SENT);
    expect(savedNotification.providerMessageId).toBe(
      'projects/demo/messages/123',
    );
    expect(savedNotification.failureReason).toBeNull();
    expect(savedNotification.sentAt).toEqual(expect.any(Date));
    expect(savedNotification.failedAt).toBeNull();
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'notification.sent',
        notificationId: '873938a8-8dd8-47f6-a90e-3fd8787652ea',
        orderId: '3f772c45-0dd2-4187-87ef-796922b8d147',
        providerMessageId: 'projects/demo/messages/123',
      }),
    );
  });

  it('marks a notification as failed when Firebase delivery throws', async () => {
    const notificationsRepository = {
      findOneBy: (): Promise<Notification | null> =>
        Promise.resolve(createPendingNotification()),
      save: (notification: Notification): Promise<Notification> =>
        Promise.resolve(notification),
    };
    const saveSpy = jest.spyOn(notificationsRepository, 'save');
    const ordersRepository = {
      existsBy: (): Promise<boolean> => Promise.resolve(false),
    };
    const firebaseNotificationGateway = {
      send: (): Promise<string> =>
        Promise.reject(
          Object.assign(new Error('Firebase delivery is not configured.'), {
            code: 'FIREBASE_DELIVERY_NOT_CONFIGURED',
          }),
        ),
    };
    const logger = {
      info: (entry: unknown): void => {
        void entry;
      },
      warn: (entry: unknown): void => {
        void entry;
      },
      error: (entry: unknown): void => {
        void entry;
      },
    };
    const errorSpy = jest.spyOn(logger, 'error');
    const service = new NotificationsService(
      notificationsRepository as never,
      ordersRepository as never,
      firebaseNotificationGateway as FirebaseNotificationGatewayService,
      logger as never,
    );

    await service.deliverPendingNotification(
      '873938a8-8dd8-47f6-a90e-3fd8787652ea',
    );

    const firstSaveCall = saveSpy.mock.calls[0];

    if (!firstSaveCall) {
      throw new Error('Expected the notification to be persisted.');
    }

    const savedNotification = firstSaveCall[0];

    expect(savedNotification.status).toBe(NotificationStatus.FAILED);
    expect(savedNotification.providerMessageId).toBeNull();
    expect(savedNotification.failureReason).toBe(
      'FIREBASE_DELIVERY_NOT_CONFIGURED: Firebase delivery is not configured.',
    );
    expect(savedNotification.sentAt).toBeNull();
    expect(savedNotification.failedAt).toEqual(expect.any(Date));
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'notification.failed',
        notificationId: '873938a8-8dd8-47f6-a90e-3fd8787652ea',
        orderId: '3f772c45-0dd2-4187-87ef-796922b8d147',
        failureReason:
          'FIREBASE_DELIVERY_NOT_CONFIGURED: Firebase delivery is not configured.',
      }),
    );
  });

  it('skips delivery work for notifications that are already in a final state', async () => {
    const notificationsRepository = {
      findOneBy: (): Promise<Notification | null> =>
        Promise.resolve({
          ...createPendingNotification(),
          status: NotificationStatus.FAILED,
        }),
      save: (notification: Notification): Promise<Notification> =>
        Promise.resolve(notification),
    };
    const saveSpy = jest.spyOn(notificationsRepository, 'save');
    const ordersRepository = {
      existsBy: (): Promise<boolean> => Promise.resolve(false),
    };
    const firebaseNotificationGateway = {
      send: (): Promise<string> =>
        Promise.resolve('projects/demo/messages/123'),
    };
    const sendSpy = jest.spyOn(firebaseNotificationGateway, 'send');
    const logger = {
      info: (entry: unknown): void => {
        void entry;
      },
      warn: (entry: unknown): void => {
        void entry;
      },
      error: (entry: unknown): void => {
        void entry;
      },
    };
    const service = new NotificationsService(
      notificationsRepository as never,
      ordersRepository as never,
      firebaseNotificationGateway as FirebaseNotificationGatewayService,
      logger as never,
    );

    await service.deliverPendingNotification(
      '873938a8-8dd8-47f6-a90e-3fd8787652ea',
    );

    expect(sendSpy).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
