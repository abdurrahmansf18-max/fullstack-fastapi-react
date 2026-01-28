//  src/shared/types/models.ts
export type UUID = string;

export interface Category {
  id: UUID;
  name: string;
  slug: string;
  description?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Heading {
  id: UUID;
  level: 1 | 2;
  category_id?: UUID | null;
  parent_heading_id?: UUID | null;
  title: string;
  slug: string;
  description?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Content {
  id: UUID;
  heading_id: UUID;
  body: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentImage {
  id: UUID;
  content_id: UUID;
  url: string;
  alt?: string | null;
  sort_order: number;
  width?: number | null;
  height?: number | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: UUID;
  email: string;
  created_at: string;
}

export interface TokenOut {
  access_token: string;
  token_type: "bearer";
}
