// src/shared/types/dto.ts
// Create / Update isteklerinde backend'e göndereceğimiz "DTO" tipleri.
// DİKKAT: null yok; sadece undefined kullanılacak.

import type { UUID } from "./models";

// ---- Categories ----
export type CategoryCreateDTO = {
  name: string;
  description?: string;
  sort_order?: number;
};

export type CategoryUpdateDTO = {
  name?: string;
  description?: string;
  sort_order?: number;
};

// ---- Headings ----
export type HeadingCreateDTO =
  | {
      level: 1;
      category_id: UUID;
      title: string;
      description?: string;
      sort_order?: number;
    }
  | {
      level: 2;
      parent_heading_id: UUID;
      title: string;
      description?: string;
      sort_order?: number;
    };

export type HeadingUpdateDTO = {
  title?: string;
  description?: string;
  sort_order?: number;
};

// ---- Contents ----
export type ContentCreateDTO = {
  heading_id: UUID;
  body: string;
  description?: string;
};

export type ContentUpdateDTO = {
  body?: string;
  description?: string;
};

// ---- Content Images ----
export type ContentImageCreateDTO = {
  content_id: UUID;
  url: string;
  alt?: string;
  sort_order?: number;
  width?: number;
  height?: number;
};

export type ContentImageUpdateDTO = {
  url?: string;
  alt?: string;
  sort_order?: number;
  width?: number;
  height?: number;
};
