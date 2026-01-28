// src/shared/api/public.ts
import { http } from "./client";
import type {
  CategoryPublic as Category,
  HeadingPublic as Heading,
  PageOut as Page,
  SearchHit,
  ContentPublic as Content,
  MenuNode,
} from "../types/public";
import type { ContentImage } from "../types/models";

export const PublicApi = {
  categories: () => http.get<Category[]>("/categories"),
  headingsL1: (categorySlug: string) =>
    http.get<Heading[]>(`/categories/${categorySlug}/headings`),
  headingsL2: (categorySlug: string, h1Slug: string) =>
    http.get<Heading[]>(`/categories/${categorySlug}/${h1Slug}/headings`),
  page: (categorySlug: string, h1Slug: string, h2Slug: string) =>
    http.get<Page>(`/page/${categorySlug}/${h1Slug}/${h2Slug}`),
  contentsOf: (headingId: string) =>
    http.get<Content[]>(`/public/contents?heading_id=${headingId}`),
  search: (q: string, limit = 20) =>
    http.get<SearchHit[]>(`/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  menu: () => http.get<MenuNode[]>("/menu"),
  contentImages: (contentId: string) => {
    return http.get<ContentImage[]>(`/contents/${contentId}/images`);
  },
};
