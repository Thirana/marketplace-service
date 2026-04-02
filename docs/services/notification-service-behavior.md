# Notification Service Behavior

## Scope

This note summarizes the notification behavior implemented mainly by:

1. `src/modules/notifications/services/notifications.service.ts`
2. `src/modules/notifications/services/firebase-notification-gateway.service.ts`
3. `src/modules/notifications/entities/notification.entity.ts`
4. `src/modules/notifications/dto/notification-response.dto.ts`
5. `src/modules/orders/services/orders.service.ts`

The focus is the `NotificationsService` runtime behavior behind notification persistence, delivery scheduling, delivery state transitions, and notification reads.

## Service Responsibility

`NotificationsService` is responsible for four things:

1. creating persisted notification intent inside the order transaction
2. scheduling delivery after commit
3. updating terminal delivery state
4. serving notification reads for an order

This means the service manages durable notification state, not just provider calls.

## Notification Intent Creation

`createPendingOrderCreatedNotification(...)` creates the initial notification row.

That row contains:

1. `orderId`
2. `type = ORDER_CREATED`
3. `status = PENDING`
4. `targetDeviceToken`
5. `title`
6. `body`

This method receives an `EntityManager` so it can participate in the surrounding order transaction.

Operational meaning:

1. if the order transaction rolls back, the notification row rolls back too
2. committed orders always have matching committed notification intent

## Delivery Scheduling

`scheduleDelivery(notificationId)` uses `setImmediate(...)` to trigger delivery work after the order path returns control.

This is a deliberate non-blocking design.

Operational meaning:

1. provider latency does not extend order response time
2. provider failure does not fail the committed order
3. the side effect happens after the core business write is durable

## Delivery Execution

`deliverPendingNotification(notificationId)` performs the delivery attempt.

The method:

1. loads the persisted notification row
2. skips work if the row does not exist
3. skips work if status is no longer `PENDING`
4. calls `firebaseNotificationGateway.send(notification)`
5. updates the notification row based on the provider outcome

This is a state-transition flow over persisted data, not a fire-and-forget provider call.

## Terminal State Transitions

On success, the service calls `markAsSent(...)`.

That updates:

1. `status = SENT`
2. `providerMessageId`
3. `sentAt`
4. `failureReason = null`
5. `failedAt = null`

On failure, the service calls `markAsFailed(...)`.

That updates:

1. `status = FAILED`
2. `providerMessageId = null`
3. `failureReason`
4. `failedAt`
5. `sentAt = null`

Operational meaning:

1. final delivery outcome is durable and queryable
2. notification lifecycle can be inspected after the original request has completed

## Failure Handling

The service treats provider failure as observable but non-fatal to order creation.

Failure inputs may include:

1. missing Firebase credentials
2. invalid Firebase credentials
3. provider rejection
4. invalid device token

The service converts failures into:

1. persisted `FAILED` state
2. stored `failureReason`
3. structured error logs

It does not rethrow those failures back into the order response path after commit.

## Notification Reads

`listByOrderId(orderId)` supports the admin read path.

The method:

1. verifies that the parent order exists
2. loads notifications by `orderId`
3. orders them by `createdAt ASC, id ASC`
4. maps them into `NotificationResponseDto`

If the order does not exist, the service returns `ORDER_NOT_FOUND`.

This makes the API distinguish between:

1. an order that exists with zero notifications
2. an invalid order identifier

## Notification Content Construction

`buildOrderCreatedNotificationContent(...)` currently creates a deterministic payload for order-created notifications.

Current content model:

1. title: `Order confirmed`
2. body includes the order identifier

This keeps the persisted notification row reviewable and suitable for both provider delivery and admin inspection.

## Firebase Gateway Separation

Firebase-specific behavior is isolated behind `FirebaseNotificationGatewayService`.

`NotificationsService` does not manage:

1. Admin SDK initialization
2. provider credentials
3. provider request construction details

Instead, it works with domain-level notification records and delegates transport-specific behavior to the gateway.

Operational meaning:

1. provider coupling stays contained
2. delivery behavior is easier to test
3. the service remains focused on notification state management

## Operational Guarantees

The current service behavior provides these guarantees:

1. notification intent is durable
2. delivery is attempted only after commit
3. final state is persisted as `SENT` or `FAILED`
4. notification reads are backed by stored state, not inferred from logs
5. provider failure remains non-blocking for order creation

In practical terms, `NotificationsService` is the state manager for the notification lifecycle. Firebase is only the external delivery mechanism.
