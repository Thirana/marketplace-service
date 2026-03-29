import { ConfigType } from '@nestjs/config';
import { format, transports } from 'winston';
import { loggingConfig } from '../../config';

/**
 * Creates the JSON logger configuration used by Nest and the application
 * request pipeline.
 */
export const createWinstonOptions = (
  logging: ConfigType<typeof loggingConfig>,
) => ({
  level: logging.level,
  defaultMeta: {
    service: 'marketplace-service',
  },
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json(),
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json(),
      ),
    }),
  ],
  exceptionHandlers: [
    new transports.Console({
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json(),
      ),
    }),
  ],
  rejectionHandlers: [
    new transports.Console({
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json(),
      ),
    }),
  ],
});
