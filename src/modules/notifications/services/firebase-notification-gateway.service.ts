import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  App as FirebaseAdminApp,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { Message } from 'firebase-admin/messaging';
import { firebaseConfig } from '../../../config';
import { Notification } from '../entities/notification.entity';

const FIREBASE_ADMIN_APP_NAME = 'marketplace-service';
const FIREBASE_DELIVERY_NOT_CONFIGURED_ERROR_CODE =
  'FIREBASE_DELIVERY_NOT_CONFIGURED';

class FirebaseDeliveryConfigurationError extends Error {
  readonly code = FIREBASE_DELIVERY_NOT_CONFIGURED_ERROR_CODE;

  constructor() {
    super(
      'Firebase delivery is not configured. Provide FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY to enable push delivery.',
    );
  }
}

@Injectable()
export class FirebaseNotificationGatewayService {
  constructor(
    @Inject(firebaseConfig.KEY)
    private readonly firebaseConfiguration: ConfigType<typeof firebaseConfig>,
  ) {}

  /**
   * Sends a Firebase Cloud Messaging push for a persisted notification record
   * and returns the provider message identifier on success.
   */
  async send(notification: Notification): Promise<string> {
    const firebaseApp = this.getFirebaseAppOrThrow();

    return getMessaging(firebaseApp).send(
      this.buildFirebaseMessage(notification),
    );
  }

  /**
   * Converts the persisted notification intent into a minimal FCM payload so
   * delivery stays driven by stored backend data rather than ad hoc request state.
   */
  private buildFirebaseMessage(notification: Notification): Message {
    return {
      token: notification.targetDeviceToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        notificationId: notification.id,
        orderId: notification.orderId,
        type: notification.type,
      },
    };
  }

  /**
   * Reuses a named Firebase Admin app across Nest app instances so repeated
   * tests and local reloads do not fail with duplicate initialization errors.
   */
  private getFirebaseAppOrThrow(): FirebaseAdminApp {
    const { projectId, clientEmail, privateKey } = this.firebaseConfiguration;

    if (!projectId || !clientEmail || !privateKey) {
      throw new FirebaseDeliveryConfigurationError();
    }

    const existingApp = getApps().find(
      (firebaseApp) => firebaseApp.name === FIREBASE_ADMIN_APP_NAME,
    );

    if (existingApp) {
      return existingApp;
    }

    return initializeApp(
      {
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      },
      FIREBASE_ADMIN_APP_NAME,
    );
  }
}
