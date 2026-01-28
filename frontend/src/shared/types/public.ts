// frontend/src/shared/types/public.ts
import type { UUID } from "./models";

export interface CategoryPublic {
  id: UUID;
  name: string;
  slug: string;
  sort_order: number;
}

export interface HeadingPublic {
  id: UUID;
  level: 1 | 2;
  title: string;
  slug: string;
  sort_order: number;
}

export interface PageOut {
  category: string;
  h1: string;
  h2?: string;
  title: string;
  body: string;
  description?: string;
}

export interface SearchHit {
  source_type: "category" | "heading" | "content";
  source_id: UUID;
  matched_text: string;
  similarity_score: number;
}

export interface ContentPublic {
  id: UUID;
  heading_id: UUID;
  body: string;
  description?: string | null;
}

export interface MenuNode {
  id: UUID;
  title: string;
  slug: string;
  sort_order: number;
  children?: MenuNode[];
}
