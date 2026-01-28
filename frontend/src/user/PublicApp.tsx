"use client";

// frontend/src/public/PublicApp.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { PublicApi } from "../shared/api/public";
import { cx } from "../shared/utils/cx";
import { slugify } from "../shared/utils/slug";
import ContentBody from "./components/ContentBody";
import Empty from "./components/Empty";
import { Link, useNavigate } from "react-router-dom";

import type { UUID } from "../shared/types/models";
import type {
  CategoryPublic as Category,
  HeadingPublic as Heading,
  PageOut as Page,
  SearchHit,
  ContentPublic as Content,
  MenuNode,
} from "../shared/types/public";

export default function App() {
  const navigate = useNavigate();
  // theme
  const [theme, setTheme] = useState<"light" | "dark">(
    (localStorage.getItem("theme") as any) || "dark"
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // data
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<Category | null>(null);

  const [headingsL1, setHeadingsL1] = useState<Heading[]>([]);
  const [activeH1, setActiveH1] = useState<Heading | null>(null);

  const [headingsL2, setHeadingsL2] = useState<Heading[]>([]);
  const [activeH2, setActiveH2] = useState<Heading | null>(null);

  const [page, setPage] = useState<Page | null>(null); // L2 page
  const [contents, setContents] = useState<Content[]>([]); // L1 content list (H2 yoksa)
  const [pageContentId, setPageContentId] = useState<UUID | null>(null);
  const [loading, setLoading] = useState(false);

  // search
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [mobileCatOpen, setMobileCatOpen] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<UUID, boolean>>({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  // Mobile menu data caches
  const [mobileH1Map, setMobileH1Map] = useState<Record<string, Heading[]>>({});
  const [mobileH2Map, setMobileH2Map] = useState<Record<string, Heading[]>>({});
  const [expandedH1, setExpandedH1] = useState<Record<string, boolean>>({});

  // ---------------------------
  // Centralized Pick Functions
  // ---------------------------
  async function pickCategory(cat: Category) {
    setActiveCat(cat);
    setActiveH1(null);
    setActiveH2(null);
    setPage(null);
    setContents([]);
    setHeadingsL2([]);
    setPageContentId(null);
    setLoading(true);
    try {
      const l1 = await PublicApi.headingsL1(cat.slug);
      setHeadingsL1(l1);
      if (l1.length > 0) {
        await pickH1(l1[0], cat.slug);
      }
    } finally {
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function pickH1(h1: Heading, catSlug?: string) {
    const slug = catSlug || activeCat?.slug;
    if (!slug) return;
    setActiveH1(h1);
    setActiveH2(null);
    setPage(null);
    setContents([]);
    setHeadingsL2([]);
    setPageContentId(null);
    setLoading(true);
    try {
      const l2 = await PublicApi.headingsL2(slug, h1.slug);
      setHeadingsL2(l2);
      if (l2.length > 0) {
        await pickH2(l2[0], slug, h1.slug);
      } else {
        const list = await PublicApi.contentsOf(h1.id);
        setContents(list);
      }
    } finally {
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function pickH2(h2: Heading, catSlug?: string, h1Slug?: string) {
    const cSlug = catSlug || activeCat?.slug;
    const pSlug = h1Slug || activeH1?.slug;
    if (!cSlug || !pSlug) return;
    setActiveH2(h2);
    setPage(null);
    setContents([]);
    setPageContentId(null);
    setLoading(true);
    try {
      const p = await PublicApi.page(cSlug, pSlug, h2.slug);
      setPage(p);
      const h2Contents = await PublicApi.contentsOf(h2.id);
      if (h2Contents.length > 0) {
        setPageContentId(h2Contents[0].id);
      }
    } finally {
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // -------- initial load --------
  useEffect(() => {
    PublicApi.categories()
      .then((cats) => {
        setCategories(cats);
        if (cats.length > 0 && !activeCat) pickCategory(cats[0]);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- search ----------
  useEffect(() => {
    const trimmed = q.trim();
    setSearchOpen(trimmed.length >= 2);
    const t = setTimeout(() => {
      if (trimmed.length < 2) {
        setHits([]);
        return;
      }
      PublicApi.search(trimmed).then(setHits).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // KISA YARDIMCI: Belirli bir L1 id'sinin hangi kategoriye ait olduğunu bul
  async function resolveCategoryByH1Id(
    h1Id: UUID
  ): Promise<{ cat: Category; h1: Heading } | null> {
    for (const cat of categories) {
      const l1List = await PublicApi.headingsL1(cat.slug);
      const found = l1List.find((h) => h.id === h1Id);
      if (found) return { cat, h1: found };
    }
    return null;
  }

  const handleSearchClick = async (hit: SearchHit) => {
    try {
      // Arama terimini sakla (içerik vurgulama için)
      sessionStorage.setItem("searchTerm", hit.matched_text);

      if (hit.source_type === "category") {
        const cat = categories.find((c) => c.id === hit.source_id);
        if (cat) await pickCategory(cat);
      } else if (hit.source_type === "heading") {
        // heading L1 mi L2 mi çöz
        for (const cat of categories) {
          const l1 = await PublicApi.headingsL1(cat.slug);
          const h1Hit = l1.find((h) => h.id === hit.source_id);
          if (h1Hit) {
            await pickCategory(cat);
            await pickH1(h1Hit, cat.slug);
            break;
          }
          for (const h1 of l1) {
            const l2 = await PublicApi.headingsL2(cat.slug, h1.slug);
            const l2Hit = l2.find((h) => h.id === hit.source_id);
            if (l2Hit) {
              await pickCategory(cat);
              await pickH1(h1, cat.slug);
              await pickH2(l2Hit, cat.slug, h1.slug);
              return;
            }
          }
        }
      } else {
        // content (ct.id) → Menüden L1/L2'yi bul, sonra L1'in kategorisini çöz, ardından aç
        const menu: MenuNode[] = await PublicApi.menu();

        // önce L1 içerikleri içinde arayalım
        for (const l1Node of menu) {
          const l1Contents = await PublicApi.contentsOf(l1Node.id);
          if (l1Contents.some((c) => c.id === hit.source_id)) {
            const resolved = await resolveCategoryByH1Id(l1Node.id);
            if (resolved) {
              await pickCategory(resolved.cat);
              // Menü node'u Heading'e çevirip slug'ını kullanabiliriz
              const h1: Heading = {
                id: l1Node.id,
                title: l1Node.title,
                slug: l1Node.slug,
                level: 1,
                sort_order: l1Node.sort_order,
              };
              await pickH1(h1, resolved.cat.slug);
              break;
            }
          }

          // L2 içerikleri
          for (const l2Node of l1Node.children || []) {
            const l2Contents = await PublicApi.contentsOf(l2Node.id);
            if (l2Contents.some((c) => c.id === hit.source_id)) {
              const resolved = await resolveCategoryByH1Id(l1Node.id);
              if (resolved) {
                await pickCategory(resolved.cat);
                const h1: Heading = {
                  id: l1Node.id,
                  title: l1Node.title,
                  slug: l1Node.slug,
                  level: 1,
                  sort_order: l1Node.sort_order,
                };
                const h2: Heading = {
                  id: l2Node.id,
                  title: l2Node.title,
                  slug: l2Node.slug,
                  level: 2,
                  sort_order: l2Node.sort_order,
                };
                await pickH1(h1, resolved.cat.slug);
                await pickH2(h2, resolved.cat.slug, h1.slug);
                return;
              }
            }
          }
        }
      }
    } catch {
      /* noop */
    } finally {
      setSearchOpen(false);
      setQ("");
    }
  };

  // theme palette
  const palette = useMemo(
    () => ({
      link: "text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors duration-200",
    }),
    []
  );

  // TOC
  const articleRef = useRef<HTMLDivElement | null>(null);
  const [toc, setToc] = useState<{ id: string; text: string; level: number }[]>(
    []
  );
  useEffect(() => {
    if (!articleRef.current) {
      setToc([]);
      return;
    }
    const raf = requestAnimationFrame(() => {
      const nodes = Array.from(
        articleRef.current!.querySelectorAll("h1,h2,h3,h4,h5,h6")
      );
      setToc(
        nodes.map((n) => ({
          id: n.id || slugify(n.textContent || ""),
          text: n.textContent || "",
          level: n.tagName === "H1" ? 1 : n.tagName === "H2" ? 2 : 3,
        }))
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [page?.body, pageContentId, contents.map((c) => c.id).join(",")]);

  // ------ shared UI styles ------
  const sectionCard =
    "group relative rounded-2xl border border-gray-200/40 dark:border-gray-700/40 " +
    "bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-6 transition-all duration-300 " +
    "hover:shadow-2xl hover:shadow-emerald-600/10 hover:border-emerald-600/30 " +
    "hover:bg-white/95 dark:hover:bg-gray-800/95";

  const itemBtn =
    "w-full text-left px-4 py-3 rounded-xl transition-all duration-300 " +
    "hover:scale-[1.02] hover:bg-emerald-50/80 dark:hover:bg-emerald-900/30 " +
    "hover:shadow-md hover:shadow-emerald-500/20";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-emerald-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-emerald-950/20 text-gray-900 dark:text-gray-100">
      <header className="sticky top-0 z-30 border-b border-gray-200/60 dark:border-gray-700/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-lg shadow-gray-900/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button
            className="md:hidden p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 hover:scale-105"
            onClick={() => setMobileCatOpen(true)}
            aria-label="Categories Menu"
          >
            <span className="text-lg">☰</span>
          </button>

          <div className="font-bold text-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 bg-clip-text text-transparent drop-shadow-sm">
            ⚡ Fastapi
          </div>

          <nav className="hidden md:flex items-center gap-2 ml-8">
            {categories.map((c) => (
              <button
                key={c.id}
                className={cx(
                  "px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105",
                  activeCat?.id === c.id
                    ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/40 font-bold shadow-md"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-md"
                )}
                onClick={() => pickCategory(c)}
              >
                {c.name}
              </button>
            ))}
          </nav>

          <div className="flex-1" />

          <div className="relative w-full max-w-[70vw] md:w-80 md:max-w-[50vw] mr-2 md:mr-4">
            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Kategori, başlık, alt başlık veya içerikte arama..."
                className="w-full rounded-xl border border-gray-300/60 dark:border-gray-600/60 
                           bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-4 py-3 pl-12 text-sm outline-none 
                           focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600
                           focus:shadow-[0_0_20px_rgba(5,150,105,0.3)] 
                           transition-all duration-300 hover:shadow-md"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 text-lg">
                🔍
              </span>
            </div>

            {searchOpen && hits && (
              <div
                className="absolute mt-3 w-full rounded-xl border border-gray-200/60 dark:border-gray-700/60 
                              bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl shadow-2xl shadow-gray-900/10 overflow-hidden z-10"
              >
                <div className="max-h-80 overflow-auto">
                  {hits.length > 0 ? (
                    hits.map((h, i) => (
                      <div
                        key={i}
                        className="px-5 py-4 text-sm border-b last:border-b-0 border-gray-100 dark:border-gray-700
                                   hover:bg-emerald-50/80 dark:hover:bg-emerald-900/30 
                                   cursor-pointer transition-all duration-200 hover:scale-[1.01]"
                        onClick={() => handleSearchClick(h)}
                      >
                        <div className="flex items-start">
                          <span
                            className="inline-block min-w-16 text-xs uppercase 
                                         text-emerald-700 dark:text-emerald-400 font-bold mt-1 
                                         bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 rounded-md"
                          >
                            {h.source_type === "category"
                              ? "Kategori"
                              : h.source_type === "heading"
                              ? "Başlık"
                              : "İçerik"}
                          </span>
                          <div className="ml-4 flex-1">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {h.matched_text}
                            </div>
                            {(h as any).context && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                {(h as any).context}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : q.trim().length >= 2 ? (
                    <div className="px-5 py-6 text-center text-gray-500 dark:text-gray-400">
                      <span className="text-2xl mb-2 block">🔍</span>
                      <div className="text-sm">Sonuç bulunamadı</div>
                      <div className="text-xs mt-1">
                        Farklı anahtar kelimeler deneyin
                      </div>
                    </div>
                  ) : (
                    <div className="px-5 py-6 text-center text-gray-500 dark:text-gray-400">
                      <span className="text-2xl mb-2 block">💡</span>
                      <div className="text-sm">
                        Arama yapmak için en az 2 karakter girin
                      </div>
                      <div className="text-xs mt-1">
                        Kategori, başlık veya içerik arayabilirsiniz
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <a
            href="/admin"
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 
             text-white text-sm font-semibold shadow-lg shadow-emerald-600/30 transition-all duration-300 hover:scale-105"
          >
            🔒 Admin
          </a>

          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="ml-3 p-3 rounded-xl bg-gradient-to-r from-amber-100 to-amber-200 dark:from-slate-700 dark:to-slate-600 
                       hover:shadow-lg hover:scale-105 transition-all duration-300"
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
        </div>

        {mobileCatOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileCatOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-[86vw] max-w-[420px] bg-gray-900 text-gray-100 shadow-2xl">
              <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="font-bold">Menü</div>
                <button onClick={() => setMobileCatOpen(false)} className="text-2xl">×</button>
              </div>
              <div className="overflow-y-auto h-full pb-24">
                {categories.map((c) => {
                  const open = !!expandedCats[c.id];
                  return (
                    <div key={c.id} className="border-b border-white/10">
                      <button
                        className="w-full flex items-center justify-between px-4 py-4 hover:bg-white/5"
                        onClick={async () => {
                          setExpandedCats((s) => ({ ...s, [c.id]: !s[c.id] }));
                          await pickCategory(c);
                          if (!mobileH1Map[c.id]) {
                            const l1 = await PublicApi.headingsL1(c.slug);
                            setMobileH1Map((m) => ({ ...m, [c.id]: l1 }));
                          }
                        }}
                      >
                        <span className="font-semibold">{c.name}</span>
                        <span>{open ? "▾" : "▸"}</span>
                      </button>
                      {open && (
                        <div className="pl-2">
                          {(mobileH1Map[c.id] || []).map((h1) => {
                            const h1open = !!expandedH1[h1.id];
                            return (
                              <div key={h1.id} className="border-t border-white/5">
                                <button
                                  className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-white/5"
                                  onClick={async () => {
                                    setExpandedH1((s) => ({ ...s, [h1.id]: !s[h1.id] }));
                                    await pickH1(h1, c.slug);
                                    if (!mobileH2Map[h1.id]) {
                                      const l2 = await PublicApi.headingsL2(c.slug, h1.slug);
                                      setMobileH2Map((m) => ({ ...m, [h1.id]: l2 }));
                                    }
                                  }}
                                >
                                  <span>{h1.title}</span>
                                  <span>{h1open ? "▾" : "▸"}</span>
                                </button>
                                {h1open && (
                                  <div className="pl-3">
                                    {(mobileH2Map[h1.id] || []).map((h2) => (
                                      <button
                                        key={h2.id}
                                        className="block w-full text-left px-4 py-2 text-sm hover:bg-white/5"
                                        onClick={async () => {
                                          await pickH2(h2, c.slug, h1.slug);
                                          setMobileCatOpen(false);
                                        }}
                                      >
                                        {h2.title}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-10 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 sm:gap-10">
        <section className="min-h-[60vh]">
          {!activeCat && (
            <Empty
              title="Select a category"
              subtitle="Choose a category from the navigation to get started"
              icon="📂"
            />
          )}
          {activeCat && !activeH1 && (
            <Empty
              title="Select a topic"
              subtitle="Choose a topic from the navigation to view content"
              icon="📑"
            />
          )}
          {activeCat &&
            activeH1 &&
            headingsL2.length > 0 &&
            !activeH2 &&
            !page && (
              <Empty
                title="Select a subtopic"
                subtitle="Choose a subtopic from the navigation to view content"
                icon="📋"
              />
            )}

          {loading && (
            <div className="flex items-center gap-4 text-emerald-700 dark:text-emerald-400 py-8">
              <span className="animate-spin text-2xl">⏳</span>
              <span className="text-lg font-medium">Yükleniyor…</span>
            </div>
          )}

          {page && !loading && (
            <article
              ref={articleRef}
              className="prose prose-gray dark:prose-invert max-w-none prose-base sm:prose-lg"
            >
              <div
                className="mb-6 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-3 font-medium 
                              bg-gray-50/80 dark:bg-gray-800/50 rounded-xl px-4 py-3 backdrop-blur-sm"
              >
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  {activeCat?.name}
                </span>
                <span className="text-gray-400">•</span>
                <span>{activeH1?.title}</span>
                {activeH2 && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span>{activeH2.title}</span>
                  </>
                )}
              </div>
              <h1 className="mb-4 sm:mb-6 text-2xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                {page.title}
              </h1>
              {page.description && (
                <p className="text-base sm:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-10 leading-relaxed">
                  {page.description}
                </p>
              )}
              <ContentBody
                md={page.body}
                linkClass={palette.link}
                contentId={pageContentId || undefined}
              />
            </article>
          )}

          {headingsL2.length === 0 && contents.length > 0 && !loading && (
            <div ref={articleRef} className="space-y-16">
              {contents.map((ct) => (
                <article
                  key={ct.id}
                  className="prose prose-gray dark:prose-invert max-w-none prose-base sm:prose-lg pb-8 sm:pb-12 border-b last:border-b-0 border-gray-200/60 dark:border-gray-700/60"
                >
                  <ContentBody
                    md={ct.body}
                    linkClass={palette.link}
                    contentId={ct.id}
                  />
                </article>
              ))}
            </div>
          )}

          {/* Mobile Navigation and TOC */}
          <div className="lg:hidden mt-6 space-y-4">
            {activeCat && (
              <div className="rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/90">
                <button
                  onClick={() => setMobileNavOpen((s) => !s)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
                >
                  <span>Navigation</span>
                  <span className="text-emerald-600">{mobileNavOpen ? "▾" : "▸"}</span>
                </button>
                {mobileNavOpen && (
                  <div className="px-2 pb-3 space-y-2">
                    {headingsL1.map((h) => (
                      <button
                        key={h.id}
                        className="block w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-emerald-50/70 dark:hover:bg-emerald-900/20"
                        onClick={() => pickH1(h)}
                      >
                        {h.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/90">
              <button
                onClick={() => setMobileTocOpen((s) => !s)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
              >
                <span>Table of contents</span>
                <span className="text-emerald-600">{mobileTocOpen ? "▾" : "▸"}</span>
              </button>
              {mobileTocOpen && (
                <div className="px-2 pb-3 text-sm">
                  {toc.length === 0 && (
                    <div className="text-gray-500 italic px-3 py-2">No headings found</div>
                  )}
                  {toc.map((h, i) => (
                    <a
                      key={i}
                      href={`#${h.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const el = document.getElementById(h.id);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        setMobileTocOpen(false);
                      }}
                      className={cx(
                        "block rounded-xl px-3 py-2 hover:bg-emerald-50/70 dark:hover:bg-emerald-900/20",
                        h.level === 1 && "font-semibold",
                        h.level === 2 && "pl-5",
                        h.level === 3 && "pl-8",
                      )}
                    >
                      {h.text}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-8">
            {activeCat && (
              <div className={sectionCard}>
                <div className="pointer-events-none absolute -inset-1 rounded-3xl opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br from-emerald-600/20 via-teal-500/15 to-transparent" />
                <div className="text-sm font-bold mb-6 text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  Navigation
                </div>

                <div className="space-y-2">
                  {headingsL1.map((h) => {
                    const active = activeH1?.id === h.id;
                    return (
                      <div key={h.id} className="rounded-xl">
                        <button
                          className={cx(
                            itemBtn,
                            active
                              ? "text-emerald-800 dark:text-emerald-200 bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/20 ring-2 ring-emerald-500/30 font-bold shadow-md"
                              : "text-gray-700 dark:text-gray-300 hover:text-emerald-700 dark:hover:text-emerald-300"
                          )}
                          onClick={() => pickH1(h)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{h.title}</span>
                            {active && headingsL2.length > 0 && (
                              <span className="text-emerald-600 ml-3 text-lg">
                                ▾
                              </span>
                            )}
                          </div>
                        </button>

                        {active && headingsL2.length > 0 && (
                          <div className="mt-3 ml-3 pl-4 border-l-3 border-emerald-300 dark:border-emerald-700 space-y-2">
                            {headingsL2.map((ch) => {
                              const a2 = activeH2?.id === ch.id;
                              return (
                                <button
                                  key={ch.id}
                                  className={cx(
                                    "block w-full text-left rounded-xl px-4 py-3 text-sm transition-all duration-300 hover:scale-[1.02]",
                                    a2
                                      ? "text-emerald-800 dark:text-emerald-200 bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/20 ring-2 ring-emerald-500/30 font-semibold shadow-md"
                                      : "text-gray-600 dark:text-gray-400 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-300"
                                  )}
                                  onClick={() => pickH2(ch)}
                                >
                                  {ch.title}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={sectionCard}>
              <div className="pointer-events-none absolute -inset-1 rounded-3xl opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br from-emerald-600/20 via-teal-500/15 to-transparent" />
              <div className="text-sm font-bold mb-6 text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                Table of contents
              </div>
              <nav className="text-sm space-y-2">
                {toc.length === 0 && (
                  <div className="text-gray-500 italic py-4">
                    No headings found
                  </div>
                )}
                {toc.map((h, i) => (
                  <a
                    key={i}
                    href={`#${h.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById(h.id);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                        // Hash'i güncelle ama tam yeniden yönlendirme yapma
                        history.replaceState(null, "", `#${h.id}`);
                      }
                    }}
                    className={cx(
                      "block rounded-xl px-4 py-3 transition-all duration-300 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-300 hover:scale-[1.02] hover:shadow-sm",
                      h.level === 1 && "font-bold text-base",
                      h.level === 2 && "pl-6 font-medium",
                      h.level === 3 && "pl-10"
                    )}
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
