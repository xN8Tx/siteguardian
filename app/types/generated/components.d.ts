import type { Schema, Struct } from '@strapi/strapi';

export interface ComponentsUrl extends Struct.ComponentSchema {
  collectionName: 'components_components_urls';
  info: {
    displayName: 'url';
    icon: 'code';
  };
  attributes: {
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'components.url': ComponentsUrl;
    }
  }
}
