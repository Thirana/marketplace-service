import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ADMIN_API_KEY_HEADER } from './common/auth/admin-api-key.constants';

/**
 * Registers the interactive Swagger document once the first business endpoints
 * exist, keeping API review and manual verification practical during later
 * phases.
 */
export const configureSwagger = (app: INestApplication): void => {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Marketplace Service')
      .setDescription('Mock backend for marketplace assessment workflows.')
      .setVersion('1.0.0')
      .addTag('products', 'Admin product management and public catalog routes')
      .addApiKey(
        {
          type: 'apiKey',
          in: 'header',
          name: ADMIN_API_KEY_HEADER,
          description: 'Admin API key required for protected product routes.',
        },
        'adminApiKey',
      )
      .build(),
  );

  SwaggerModule.setup('docs', app, document);
};
