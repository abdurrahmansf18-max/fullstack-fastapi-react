// FlashIcon component for login logo
function FlashIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path
        d="M13 5L8 13h3l-1 6 6-9h-3l1-5z"
        fill="#000"
      />
    </svg>
  );
}

"use client";

// frontend/src/admin/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import ContentImageManager from "./components/ContentImageManager";
import CreateCategoryForm from "./components/CreateCategoryForm";
import CreateH1Form from "./components/CreateH1Form";
import CreateH2Form from "./components/CreateH2Form";
import CreateContentForm from "./components/CreateContentForm";
import CreateAdminForm from "./components/CreateAdminForm";

import { useAdminAuth } from "../shared/hooks/useAdminAuth";
import {
  AdminAuth,
  AdminUsersApi,
  CategoriesApi,
  HeadingsApi,
  ContentsApi,
  ContentImagesApi,
} from "../shared/api/admin";

import type {
  UUID,
  Category,
  Heading,
  Content,
  AdminUser,
} from "../shared/types/models";

interface TempImageData {
  url: string;
  alt: string;
  sortOrder: number;
  file?: File;
  width?: number;
  height?: number;
}

function cx(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// Boş string → null (API'nin alanı temizlemesi için)
const toUndef = (s: string | null | undefined) => {
  const v = (s ?? "").trim();
  return v === "" ? null : v;
};

const sectionCard =
  "group relative rounded-3xl border border-gray-200/40 dark:border-gray-800/40 " +
  "bg-gradient-to-br from-white/95 via-gray-50/90 to-gray-100/80 " +
  "dark:from-gray-900/95 dark:via-gray-900/90 dark:to-gray-950/80 " +
  "p-8 transition-all duration-500 backdrop-blur-xl " +
  "hover:shadow-2xl hover:shadow-emerald-800/20 hover:border-emerald-700/50 " +
  "hover:scale-[1.01] hover:-translate-y-1";

const itemCard =
  "relative p-6 rounded-2xl border border-gray-200/50 dark:border-gray-800/50 " +
  "bg-gradient-to-r from-white/90 via-gray-50/80 to-gray-100/70 " +
  "dark:from-gray-900/90 dark:via-gray-900/80 dark:to-gray-950/70 " +
  "transition-all duration-300 backdrop-blur-sm " +
  "hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-800/25 " +
  "hover:ring-2 hover:ring-emerald-700/50 hover:border-emerald-700/70 " +
  "hover:-translate-y-0.5 group";

export default function App() {
  // theme
  const [theme, setTheme] = useState<"light" | "dark">(
    (localStorage.getItem("theme") as any) || "dark"
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // auth
  const {
    token,
    login,
    logout,
    loading: authLoading,
    error: authError,
  } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // notification
  const [notification, setNotification] = useState<{
    message: string;
    type: "error" | "success" | "warning";
  } | null>(null);
  const showNotification = (
    m: string,
    t: "error" | "success" | "warning" = "error"
  ) => {
    setNotification({ message: m, type: t });
    setTimeout(() => setNotification(null), 4000);
  };

  // state
  const [cats, setCats] = useState<Category[]>([]);
  const [h1s, setH1s] = useState<Heading[]>([]);
  const [h2s, setH2s] = useState<Heading[]>([]);
  const [contents, setContents] = useState<Content[]>([]);
  const [activeCat, setActiveCat] = useState<Category | null>(null);
  const [activeH1, setActiveH1] = useState<Heading | null>(null);
  const [currentHeadingId, setCurrentHeadingId] = useState<UUID | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [contentImages, setContentImages] = useState<any[]>([]);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  // fetchers
  const fetchCats = () => CategoriesApi.list().then(setCats);
  const fetchH1s = (catId: UUID) =>
    HeadingsApi.list({ level: 1, category_id: catId }).then(setH1s);
  const fetchH2s = (h1Id: UUID) =>
    HeadingsApi.list({ level: 2, parent_heading_id: h1Id }).then(setH2s);
  const fetchContentsByHeading = (headingId: UUID) => {
    setCurrentHeadingId(headingId);
    return ContentsApi.list(headingId).then(setContents);
  };
  const fetchAdmins = () => AdminUsersApi.list().then(setAdmins);

  // L1 seçilince içerik önizleme
  useEffect(() => {
    if (!activeH1) return;
    if (h2s.length > 0) fetchContentsByHeading(h2s[0].id).catch(() => {});
    else fetchContentsByHeading(activeH1.id).catch(() => {});
  }, [activeH1, h2s.length]);

  useEffect(() => {
    setSelectedContent(null);
  }, [currentHeadingId]);

  // token varsa açılış sorguları
  useEffect(() => {
    if (!token) return;
    AdminAuth.me()
      .then(() => {
        fetchCats();
        fetchAdmins();
      })
      .catch(() => {});
  }, [token]);

  // -------- CRUD helpers --------
  // Category
  const [modal, setModal] = useState<{
    type: "prompt" | "confirm" | "alert";
    title: string;
    message?: string;
    defaultValue?: string;
    onConfirm: (value?: string) => void;
    onCancel?: () => void;
  } | null>(null);

  const showPrompt = (
    title: string,
    defaultValue = "",
    message?: string
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      setModal({
        type: "prompt",
        title,
        message,
        defaultValue,
        onConfirm: (value) => {
          setModal(null);
          resolve(value || null);
        },
        onCancel: () => {
          setModal(null);
          resolve(null);
        },
      });
    });
  };

  const showConfirm = (title: string, message?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setModal({
        type: "confirm",
        title,
        message,
        onConfirm: () => {
          setModal(null);
          resolve(true);
        },
        onCancel: () => {
          setModal(null);
          resolve(false);
        },
      });
    });
  };

  const showAlert = (title: string, message?: string): Promise<void> => {
    return new Promise((resolve) => {
      setModal({
        type: "alert",
        title,
        message,
        onConfirm: () => {
          setModal(null);
          resolve();
        },
      });
    });
  };
  async function createCategory(name: string, description?: string) {
    try {
      await CategoriesApi.create({ name, description: toUndef(description) });
      await fetchCats();
      showNotification("Kategori eklendi", "success");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Hata";
      if (String(err?.response?.status) === "409") {
        showNotification("Aynı isimde bir kategori zaten var", "error");
      } else {
        showNotification(`Kategori eklenemedi: ${msg}`, "error");
      }
      throw err;
    }
  }
  async function updateCategory(id: UUID, fields: any) {
    await CategoriesApi.update(id, {
      ...fields,
      description: toUndef(fields.description),
    });
    await fetchCats();
  }
  async function deleteCategory(id: UUID) {
    const confirmed = await showConfirm(
      "Kategori Sil",
      "Bu kategoriyi kalıcı olarak silmek istiyor musun? (Bağlı başlıklar da silinir)"
    );
    if (!confirmed) return;

    // Optimistic: ekranda anında düşür
    setCats((prev) => prev.filter((c) => c.id !== id));
    if (activeCat?.id === id) {
      setActiveCat(null);
      setH1s([]);
      setH2s([]);
      setContents([]);
      setCurrentHeadingId(null);
    }

    try {
      await CategoriesApi.remove(id);
    } finally {
      // Senkronizasyon (opsiyonel ama iyi olur)
      fetchCats().catch(() => {});
    }
  }

  // Heading
  async function createH1(catId: UUID, title: string) {
    await HeadingsApi.create({ level: 1, category_id: catId, title });
    await fetchH1s(catId);
  }
  async function createH2(parentId: UUID, title: string) {
    await HeadingsApi.create({ level: 2, parent_heading_id: parentId, title });
    await fetchH2s(parentId);
  }
  async function updateHeading(id: UUID, fields: any) {
    await HeadingsApi.update(id, {
      ...fields,
      description: toUndef(fields.description),
    });
    if (activeCat) await fetchH1s(activeCat.id);
    if (activeH1) await fetchH2s(activeH1.id);
  }
  // --- Heading
  async function deleteHeading(id: UUID) {
    const confirmed = await showConfirm(
      "Başlık Sil",
      "Bu başlığı kalıcı olarak silmek istiyor musun? (Alt başlıklar/İçerikler de silinir)"
    );
    if (!confirmed) return;

    // ✅ Optimistic
    setH1s((prev) => prev.filter((h) => h.id !== id));
    setH2s((prev) => prev.filter((h) => h.id !== id));

    // L1 seçiliyse temizle
    if (activeH1?.id === id) setActiveH1(null);

    // İçerik panelinde bu başlık açık ise temizle
    if (currentHeadingId === id) {
      setCurrentHeadingId(null);
      setContents([]);
    }

    try {
      await HeadingsApi.remove(id);
    } finally {
      // Listeyi tekrar senkronize et
      if (activeCat) fetchH1s(activeCat.id).catch(() => {});
    }
  }

  async function createContent(
    headingId: UUID,
    body: string,
    images: TempImageData[],
    description?: string
  ) {
    try {
      const newContent = await ContentsApi.create({
        heading_id: headingId,
        body,
        description: toUndef(description),
      });

      if (images.length > 0) {
        const processedImages: Array<{
          url: string;
          alt: string;
          sortOrder: number;
        }> = [];

        // Process each image - upload files first, then create ContentImage records
        for (const image of images) {
          if (image.file) {
            // Upload file and get URL
            try {
              const uploadResult = await ContentImagesApi.upload(
                image.file,
                newContent.id, // Use actual content ID
                image.alt,
                image.sortOrder,
                image.width,
                image.height
              );
              processedImages.push({
                url: uploadResult.url,
                alt: image.alt,
                sortOrder: image.sortOrder,
              });
            } catch (uploadError) {
              console.error("[v0] File upload error:", uploadError);
              // Rollback content creation
              try {
                await ContentsApi.remove(newContent.id);
                showNotification(
                  `Dosya yükleme hatası: ${
                    uploadError instanceof Error
                      ? uploadError.message
                      : "Bilinmeyen hata"
                  }`,
                  "error"
                );
              } catch (rollbackError) {
                console.error("[v0] Rollback error:", rollbackError);
                showNotification(
                  "İçerik oluşturuldu ancak resim yüklenemedi!",
                  "warning"
                );
              }
              return;
            }
          } else if (image.url) {
            // Use URL-based image
            processedImages.push({
              url: image.url,
              alt: image.alt,
              sortOrder: image.sortOrder,
            });
          }
        }

        // Create ContentImage records for URL-based images (file uploads are already handled by upload endpoint)
        const urlBasedImages = processedImages.filter(
          (img) =>
            !images.find(
              (orig) => orig.file && orig.sortOrder === img.sortOrder
            )
        );

        if (urlBasedImages.length > 0) {
          const imagePromises = urlBasedImages.map((image) => {
            const originalImage = images.find(
              (img) => img.sortOrder === image.sortOrder
            );
            return ContentImagesApi.create({
              content_id: newContent.id,
              url: image.url,
              alt: image.alt,
              sort_order: image.sortOrder,
              width: originalImage?.width,
              height: originalImage?.height,
            });
          });

          try {
            await Promise.all(imagePromises);
          } catch (imageError) {
            console.error("[v0] Image creation error:", imageError);
            try {
              await ContentsApi.remove(newContent.id);
              showNotification(
                "Resim kaydetme hatası nedeniyle işlem iptal edildi!",
                "error"
              );
            } catch (rollbackError) {
              console.error("[v0] Rollback error:", rollbackError);
              showNotification(
                "İçerik oluşturuldu ancak bazı resimler kaydedilemedi!",
                "warning"
              );
            }
            return;
          }
        }

        showNotification(
          `İçerik ve ${images.length} resim başarıyla eklendi!`,
          "success"
        );
      } else {
        showNotification("İçerik başarıyla eklendi!", "success");
      }

      await fetchContentsByHeading(currentHeadingId ?? headingId);
    } catch (error) {
      console.error("[v0] Content creation error:", error);
      showNotification("İçerik eklenirken hata oluştu!", "error");
    }
  }
  async function updateContent(id: UUID, fields: any) {
    const c = await ContentsApi.update(id, {
      ...fields,
      description: toUndef(fields.description),
    });
    await fetchContentsByHeading(currentHeadingId ?? c.heading_id);
  }
  async function deleteContent(id: UUID) {
    const confirmed = await showConfirm(
      "İçerik Sil",
      "Bu içeriği kalıcı olarak silmek istiyor musun?"
    );
    if (!confirmed) return;

    if (selectedContent?.id === id) {
      setSelectedContent(null);
    }

    // Optimistic
    setContents((prev) => prev.filter((c) => c.id !== id));

    try {
      await ContentsApi.remove(id);
    } finally {
      if (currentHeadingId)
        fetchContentsByHeading(currentHeadingId).catch(() => {});
    }
  }

  // Admin users
  async function createAdmin(email: string, password: string) {
    const exists = admins.some(
      (a) => a.email.toLowerCase() === email.toLowerCase()
    );
    if (exists) {
      showNotification(
        "Bu e-posta adresi ile zaten bir admin mevcut!",
        "error"
      );
      return;
    }
    await AdminUsersApi.create(email, password);
    await fetchAdmins();
  }
  async function deleteAdmin(id: UUID) {
    const confirmed = await showConfirm("Admin Sil", "Bu admin silinsin mi?");
    if (!confirmed) return;

    // Optimistic
    setAdmins((prev) => prev.filter((a) => a.id !== id));

    try {
      await AdminUsersApi.remove(id);
    } finally {
      fetchAdmins().catch(() => {});
    }
  }
  async function changeAdminPassword(id: UUID) {
    const pw = await showPrompt("Şifre Değiştir", "", "Yeni şifre:");
    if (!pw) return;
    await AdminUsersApi.changePw(id, pw);
    await showAlert("Başarılı", "Şifre güncellendi");
  }

  const hasMainHeadingContent = useMemo(
    () =>
      activeH1 ? contents.some((c) => c.heading_id === activeH1.id) : false,
    [activeH1, contents]
  );

  const hasCurrentHeadingContent = useMemo(
    () =>
      currentHeadingId
        ? contents.some((c) => c.heading_id === currentHeadingId)
        : false,
    [currentHeadingId, contents]
  );

  // LOGIN VIEW with enhanced styling
  if (!token) {
    const normalizeError = (err: any): string => {
      try {
        const detail = err?.response?.data?.detail ?? err?.detail ?? err;
        if (Array.isArray(detail) && detail.length) {
          const msgs = detail.map((d: any) => d?.msg || "").filter(Boolean);
          if (msgs.length) return msgs.join(" • ");
        }
        if (typeof detail === "string") return detail;
      } catch {}
      return "Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.";
    };

    return (
      <div
        className={`
          min-h-screen flex items-center justify-center relative overflow-hidden
          bg-gradient-to-br
          from-gray-100 via-gray-200 to-gray-300
          dark:from-gray-950 dark:via-gray-900 dark:to-gray-800/20
        `}
      >
        <div className="pointer-events-none absolute inset-0">
          {/* Light mode enhanced glow */}
          <div
            className="absolute top-1/4 left-1/3 w-[800px] h-[800px]
                          rounded-full blur-3xl bg-emerald-600/20 dark:hidden animate-pulse"
          />
          <div
            className="absolute bottom-1/3 right-1/4 w-[600px] h-[600px]
                          rounded-full blur-3xl bg-forest-600/15 dark:hidden animate-pulse"
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px]
                          rounded-full blur-3xl bg-emerald-700/10 dark:hidden"
          />

          {/* Dark mode enhanced glow */}
          <div
            className="hidden dark:block absolute top-1/4 left-1/3 w-[800px] h-[800px]
                          rounded-full blur-3xl bg-emerald-600/25 animate-pulse"
          />
          <div
            className="hidden dark:block absolute bottom-1/3 right-1/4 w-[600px] h-[600px]
                          rounded-full blur-3xl bg-emerald-700/20 animate-pulse"
          />
          <div
            className="hidden dark:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px]
                          rounded-full blur-3xl bg-emerald-800/15"
          />
        </div>

        {/* Enhanced floating particles */}
        <div className="pointer-events-none absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-lime-400/40 dark:bg-lime-400/20 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        {/* --- TOAST (ortalanmış modal) --- */}
        {notification && (
          <>
            <style>{`
              @keyframes modalIn { from { opacity:0; transform: scale(0.95) } to { opacity:1; transform: scale(1) } }
            `}</style>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div
                className={[
                  "animate-[modalIn_.25s_ease-out] max-w-md w-full mx-4",
                  "rounded-2xl shadow-2xl px-6 py-5 border backdrop-blur-md",
                  notification.type === "error"
                    ? "bg-red-50/95 dark:bg-red-950/90 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
                    : notification.type === "warning"
                    ? "bg-amber-50/95 dark:bg-amber-950/90 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                    : "bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200",
                ].join(" ")}
                style={{
                  boxShadow:
                    notification.type === "error"
                      ? "0 20px 50px rgba(239,68,68,.35)"
                      : notification.type === "warning"
                      ? "0 20px 50px rgba(245,158,11,.35)"
                      : "0 20px 50px rgba(16,185,129,.30)",
                }}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">
                    {notification.type === "error"
                      ? "⚠️"
                      : notification.type === "warning"
                      ? "💡"
                      : "✅"}
                  </span>
                  <p className="font-medium text-base flex-1">
                    {notification.message}
                  </p>
                  <button
                    onClick={() => setNotification(null)}
                    className="ml-2 text-xl leading-none hover:opacity-70 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <div
          className="
            relative z-10 w-full max-w-lg group
            transition-all duration-500
            hover:scale-[1.02]
          "
        >
          <div
            className="
              rounded-3xl border
              border-gray-200/50 dark:border-gray-800/50 p-12
              bg-white/95 dark:bg-gray-900/90 backdrop-blur-3xl
              shadow-[0_40px_140px_rgba(132,204,22,.20)]
              dark:shadow-[0_40px_140px_rgba(132,204,22,.15)]
              transition-all duration-500
              group-hover:shadow-[0_50px_180px_rgba(132,204,22,.35)]
              group-hover:border-lime-400/40
              relative overflow-hidden
            "
          >
            {/* Animated border gradient */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-lime-500/20 via-emerald-500/20 to-teal-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />

            <div className="relative z-10">
              <div className="text-center mb-12">
                <div
                  className="
                    inline-flex items-center justify-center w-20 h-20 rounded-3xl
                    bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 mb-6 
                    shadow-2xl shadow-emerald-700/40
                    ring-4 ring-emerald-600/30 group-hover:scale-110 group-hover:rotate-3 
                    transition-all duration-500
                  "
                >
                  <FlashIcon className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                  Fastapi
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-base mt-2 font-medium">
                  Documentation Management System
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await login(email, password);
                    showNotification("Giriş başarılı!", "success");
                  } catch (err: any) {
                    showNotification(normalizeError(err), "error");
                  }
                }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="Email adresiniz"
                    className="
                      w-full rounded-2xl border border-gray-300/60 dark:border-gray-700/50
                      bg-white/90 dark:bg-gray-800/80 px-6 py-4 text-lg
                      text-gray-900 dark:text-gray-100 shadow-sm
                      focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none
                      transition-all duration-300 placeholder:text-gray-500
                      hover:border-lime-400/50 hover:shadow-md hover:shadow-lime-500/10
                    "
                  />

                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="Şifreniz"
                    className="
                      w-full rounded-2xl border border-gray-300/60 dark:border-gray-700/50
                      bg-white/90 dark:bg-gray-800/80 px-6 py-4 text-lg
                      text-gray-900 dark:text-gray-100 shadow-sm
                      focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none
                      transition-all duration-300 placeholder:text-gray-500
                      hover:border-lime-400/50 hover:shadow-md hover:shadow-lime-500/10
                    "
                  />
                </div>

                <button
                  className="
                    w-full py-4 rounded-2xl text-white font-bold text-lg
                    bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-800
                    shadow-lg hover:shadow-xl hover:shadow-emerald-700/40
                    hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-300
                    disabled:opacity-50 disabled:cursor-not-allowed
                    relative overflow-hidden group
                  "
                  disabled={authLoading}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative z-10">
                    {authLoading ? "Giriş yapılıyor..." : "🔐 Giriş Yap"}
                  </span>
                </button>
              </form>

              <div
                className="
                  mt-10 p-6 rounded-2xl border
                  bg-gradient-to-br from-emerald-100/80 via-emerald-50/60 to-emerald-100/80
                  dark:from-emerald-900/40 dark:via-emerald-950/30 dark:to-emerald-900/40
                  border-emerald-300/60 dark:border-emerald-700/50
                  text-emerald-900 dark:text-emerald-100 shadow-inner
                  backdrop-blur-sm
                "
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl">🛡️</div>
                  <div className="text-sm leading-7">
                    <div className="font-bold text-base mb-2">
                      Güvenli Erişim
                    </div>
                    <ul className="list-disc pl-5 space-y-1.5 text-emerald-800 dark:text-emerald-200">
                      <li>Sadece yetkili yöneticiler giriş yapabilir</li>
                      <li>Tüm işlemler güvenli şekilde kaydedilir</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-center mt-8">
                <button
                  onClick={() =>
                    setTheme((t) => (t === "dark" ? "light" : "dark"))
                  }
                  className="
                    p-4 rounded-2xl border border-gray-300/60 dark:border-gray-700/50
                    bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm
                    hover:bg-emerald-100 dark:hover:bg-emerald-900/30 
                    hover:border-emerald-500/60 hover:scale-105
                    transition-all duration-300 shadow-sm hover:shadow-md
                    text-2xl
                  "
                  aria-label="Tema değiştir"
                >
                  {theme === "dark" ? "🌙" : "☀️"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100/50 via-white to-gray-200/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800/20">
      {notification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className={`max-w-md w-full mx-4 p-6 rounded-2xl shadow-2xl border animate-[modalIn_.25s_ease-out] ${
              notification.type === "error"
                ? "bg-red-50/95 dark:bg-red-950/95 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
                : notification.type === "warning"
                ? "bg-amber-50/95 dark:bg-amber-950/95 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                : "bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
            }`}
            style={{
              boxShadow:
                notification.type === "error"
                  ? "0 20px 50px rgba(239,68,68,.35)"
                  : notification.type === "warning"
                  ? "0 20px 50px rgba(245,158,11,.35)"
                  : "0 20px 50px rgba(16,185,129,.30)",
            }}
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl">
                {notification.type === "error"
                  ? "⚠️"
                  : notification.type === "warning"
                  ? "⚡"
                  : "✅"}
              </span>
              <p className="font-medium text-base flex-1">
                {notification.message}
              </p>
              <button
                onClick={() => setNotification(null)}
                className="ml-2 text-xl hover:opacity-70 transition-opacity"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className={`${
              modal.type === "prompt" && modal.title === "İçerik Düzenle"
                ? "max-w-4xl w-full mx-4 h-[80vh]"
                : "max-w-md w-full mx-4"
            } p-6 rounded-2xl shadow-2xl border bg-white/95 dark:bg-gray-900/95 border-gray-200 dark:border-gray-800 animate-[modalIn_.25s_ease-out] ${
              modal.type === "prompt" && modal.title === "İçerik Düzenle"
                ? "flex flex-col"
                : ""
            }`}
          >
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {modal.title}
              </h3>
              {modal.message && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {modal.message}
                </p>
              )}
            </div>

            {modal.type === "prompt" && (
              <>
                {modal.title === "İçerik Düzenle" ? (
                  <textarea
                    defaultValue={modal.defaultValue}
                    className="w-full flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none mb-4 resize-none font-mono text-sm"
                    placeholder="Markdown içeriğinizi buraya yazın..."
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        modal.onCancel?.();
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <input
                    type="text"
                    defaultValue={modal.defaultValue}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none mb-4"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        modal.onConfirm((e.target as HTMLInputElement).value);
                      } else if (e.key === "Escape") {
                        modal.onCancel?.();
                      }
                    }}
                    autoFocus
                  />
                )}
              </>
            )}

            <div className="flex gap-3 justify-end">
              {modal.type !== "alert" && (
                <button
                  onClick={modal.onCancel}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  İptal
                </button>
              )}
              <button
                onClick={() => {
                  if (modal.type === "prompt") {
                    /* Hem input hem textarea için çalışacak şekilde güncellendi */
                    const input = document.querySelector(
                      'input[type="text"]'
                    ) as HTMLInputElement;
                    const textarea = document.querySelector(
                      "textarea"
                    ) as HTMLTextAreaElement;
                    modal.onConfirm(input?.value || textarea?.value);
                  } else {
                    modal.onConfirm();
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-medium"
              >
                {modal.type === "alert" ? "Tamam" : "Onayla"}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-xl border-b border-emerald-600/30">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-600/70 to-transparent" />

        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4 group">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl blur-xl bg-emerald-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-gradient-to-br from-emerald-700 to-emerald-800 ring-2 ring-emerald-600/40 shadow-xl group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
                <svg viewBox="0 0 48 48" className="w-8 h-8">
                  <path
                    d="M8 30c6-5 13-8 20-8l6 4c-7 0-12 2-18 7l-8-3zM20 14l6-3 12 8-7-1c-4-3-7-4-11-4z"
                    fill="white"
                  />
                </svg>
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Fastapi
              </h1>
              <p className="text-xs text-emerald-300 -mt-0.5 font-medium">
                Admin Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/"
              className="px-6 py-3 rounded-2xl text-sm font-bold text-white
                         ring-2 ring-emerald-500/60 hover:ring-emerald-400
                         bg-emerald-600/30 hover:bg-emerald-600/40
                         shadow-lg hover:shadow-emerald-600/40
                         hover:scale-105 transition-all duration-300"
            >
              🌐 Public Site
            </a>

            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="px-6 py-3 rounded-2xl text-sm font-bold text-white
                         bg-gradient-to-r from-emerald-700 to-emerald-600
                         shadow-lg hover:shadow-xl hover:shadow-emerald-600/50
                         hover:scale-105 transition-all duration-300"
            >
              {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
            </button>

            <button
              onClick={logout}
              className="px-6 py-3 rounded-2xl text-sm font-bold text-white
                         ring-2 ring-white/20 hover:ring-rose-400/60 
                         bg-white/10 hover:bg-rose-500/20
                         hover:text-rose-200 hover:scale-105 transition-all duration-300"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        <section className={sectionCard}>
          <div className="pointer-events-none absolute -inset-2 rounded-3xl opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br from-emerald-700/20 via-emerald-600/15 to-emerald-800/20" />

          <div className="relative z-10">
            <div className="font-bold mb-8 text-2xl flex items-center gap-4 text-gray-900 dark:text-white">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-800 flex items-center justify-center text-2xl text-white shadow-lg">
                📁
              </div>
              <div>
                <h2>Kategoriler</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                  Dokümantasyon kategorilerini yönetin
                </p>
              </div>
            </div>

            {cats.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <div className="text-6xl mb-4">📂</div>
                <p className="text-lg font-medium">Henüz kategori yok</p>
                <p className="text-sm">İlk kategorinizi oluşturun</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {cats.map((c) => (
                  <div key={c.id} className={itemCard}>
                    <div className="flex items-center gap-4 justify-between">
                      <button
                        className={cx(
                          "font-bold text-left flex-1 truncate text-lg transition-all duration-300",
                          activeCat?.id === c.id
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-gray-800 dark:text-gray-200 hover:text-emerald-700 dark:hover:text-emerald-400"
                        )}
                        onClick={() => {
                          setActiveCat(c);
                          setActiveH1(null);
                          setH2s([]);
                          setContents([]);
                          setCurrentHeadingId(null);
                          fetchH1s(c.id).catch(() => {});
                        }}
                        title={c.name}
                      >
                        {c.name}
                      </button>

                      <div className="flex items-center gap-3">
                        <button
                          className="p-3 rounded-xl border border-gray-300/60 dark:border-gray-600/60 hover:border-emerald-600/80 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 hover:scale-105 transition-all duration-200"
                          onClick={async () => {
                            const name = await showPrompt(
                              "Kategori Düzenle",
                              c.name || "",
                              "Yeni kategori adı"
                            );
                            if (name === null) return;
                            const sort = await showPrompt(
                              "Sıra Düzenle",
                              String(c.sort_order ?? 0),
                              "Sıra (int)"
                            );
                            const description = await showPrompt(
                              "Açıklama Düzenle",
                              c.description || "",
                              "Açıklama (opsiyonel)"
                            );
                            updateCategory(c.id, {
                              name: name || c.name,
                              sort_order: Number(sort ?? c.sort_order),
                              description: toUndef(description),
                            }).catch(() => {});
                          }}
                          title="Düzenle"
                        >
                          ✏️
                        </button>

                        <button
                          className="p-3 rounded-xl border border-gray-300/60 dark:border-gray-600/60 hover:border-rose-400/60 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:scale-105 transition-all duration-200"
                          onClick={() => deleteCategory(c.id)}
                          title="Sil"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {c.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl">
                        {c.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8">
              <CreateCategoryForm onCreate={createCategory} />
            </div>
          </div>
        </section>

        {/* HEADINGS */}
        <section className={sectionCard}>
          <div className="pointer-events-none absolute -inset-2 rounded-3xl opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br from-emerald-700/20 via-emerald-600/15 to-emerald-800/20" />

          <div className="relative z-10">
            <div className="font-bold mb-8 text-2xl flex items-center gap-4 text-gray-900 dark:text-white">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-800 flex items-center justify-center text-2xl text-white shadow-lg">
                📑
              </div>
              <div>
                <h2>Başlıklar</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                  Doküman başlıklarını ve alt başlıklarını yönetin
                </p>
              </div>
            </div>

            {!activeCat && (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <div className="text-6xl mb-4">📁</div>
                <p className="text-lg font-medium">Önce bir kategori seçin</p>
                <p className="text-sm">
                  Başlıkları görüntülemek için bir kategori seçin
                </p>
              </div>
            )}

            {activeCat && (
              <>
                {/* L1 Headings */}
                <div className="mb-10">
                  <div className="font-semibold mb-5 text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-600" />
                    <span>Ana Başlıklar</span>
                  </div>

                  {h1s.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      <div className="text-4xl mb-3">📄</div>
                      <p className="text-lg font-medium">
                        Bu kategoride başlık yok
                      </p>
                      <p className="text-sm">İlk başlığınızı oluşturun</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {h1s.map((h) => (
                        <div key={h.id} className={itemCard}>
                          <div className="flex items-center justify-between gap-4">
                            <button
                              className={cx(
                                "font-bold text-left flex-1 truncate text-lg transition-all duration-300",
                                activeH1?.id === h.id
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-gray-800 dark:text-gray-200 hover:text-emerald-700 dark:hover:text-emerald-400"
                              )}
                              onClick={() => {
                                if (activeH1?.id === h.id) {
                                  // If same heading is clicked, don't reset anything
                                  return;
                                }
                                setActiveH1(h);
                                setH2s([]);
                                setContents([]);
                                setCurrentHeadingId(null);
                                fetchH2s(h.id).catch(() => {});
                              }}
                              title={h.title}
                            >
                              {h.title}
                            </button>

                            <div className="flex items-center gap-3">
                              <button
                                className="p-3 rounded-xl border border-gray-300/60 dark:border-gray-600/60 hover:border-emerald-500/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:scale-105 transition-all duration-200"
                                onClick={async () => {
                                  const title = await showPrompt(
                                    "Başlık Düzenle",
                                    h.title || "",
                                    "Yeni başlık"
                                  );
                                  if (title === null) return;
                                  const sort = await showPrompt(
                                    "Sıra Düzenle",
                                    String(h.sort_order ?? 0),
                                    "Sıra (int)"
                                  );
                                  const description = await showPrompt(
                                    "Açıklama Düzenle",
                                    h.description || "",
                                    "Açıklama (opsiyonel)"
                                  );
                                  updateHeading(h.id, {
                                    title: title || h.title,
                                    sort_order: Number(sort ?? h.sort_order),
                                    description: toUndef(description),
                                  }).catch(() => {});
                                }}
                                title="Düzenle"
                              >
                                ✏️
                              </button>

                              <button
                                className="p-3 rounded-xl border border-gray-300/60 dark:border-gray-600/60 hover:border-rose-400/60 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:scale-105 transition-all duration-200"
                                onClick={() => deleteHeading(h.id)}
                                title="Sil"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                          {h.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl">
                              {h.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-8">
                    {activeCat && (
                      <CreateH1Form
                        onCreate={(title) => createH1(activeCat.id, title)}
                      />
                    )}
                  </div>
                </div>

                {/* L2 Headings */}
                {activeH1 && (
                  <div className="pt-8 border-t border-gray-200/40 dark:border-gray-800/40">
                    <div className="font-semibold mb-5 text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-700" />
                      <span>Alt Başlıklar</span>
                    </div>

                    {h2s.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <div className="text-4xl mb-3">📑</div>
                        <p className="text-lg font-medium">Alt başlık yok</p>
                        <p className="text-sm">İlk alt başlığınızı oluşturun</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {h2s.map((h) => (
                          <div key={h.id} className={itemCard}>
                            <div className="flex items-center justify-between gap-4">
                              <button
                                className="font-bold text-left flex-1 truncate text-lg text-gray-800 dark:text-gray-200 hover:text-emerald-700 dark:hover:text-emerald-500 transition-all duration-300"
                                title={h.title}
                                onClick={() => {
                                  fetchContentsByHeading(h.id).catch(() => {});
                                }}
                              >
                                {h.title}
                              </button>

                              <div className="flex items-center gap-3">
                                <button
                                  className="p-3 rounded-xl border border-gray-300/60 dark:border-gray-600/60 hover:border-emerald-600/80 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 hover:scale-105 transition-all duration-200"
                                  onClick={async () => {
                                    const title = await showPrompt(
                                      "Alt Başlık Düzenle",
                                      h.title || "",
                                      "Yeni alt başlık"
                                    );
                                    if (title === null) return;
                                    const sort = await showPrompt(
                                      "Sıra Düzenle",
                                      String(h.sort_order ?? 0),
                                      "Sıra (int)"
                                    );
                                    const description = await showPrompt(
                                      "Açıklama Düzenle",
                                      h.description || "",
                                      "Açıklama (opsiyonel)"
                                    );
                                    updateHeading(h.id, {
                                      title: title || h.title,
                                      sort_order: Number(sort ?? h.sort_order),
                                      description: toUndef(description),
                                    }).catch(() => {});
                                  }}
                                  title="Düzenle"
                                >
                                  ✏️
                                </button>

                                <button
                                  className="p-3 rounded-xl border border-gray-300/60 dark:border-gray-600/60 hover:border-rose-400/60 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:scale-105 transition-all duration-200"
                                  onClick={() => deleteHeading(h.id)}
                                  title="Sil"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                            {h.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl">
                                {h.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-8">
                      {contents.some((c) => c.heading_id === activeH1?.id) ? (
                        <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/60">
                          <div className="flex items-center gap-3">
                            <span className="text-amber-600 dark:text-amber-400 text-lg">
                              ⚠️
                            </span>
                            <div>
                              <p className="font-medium text-amber-800 dark:text-amber-200">
                                Ana başlığın içeriği var
                              </p>
                              <p className="text-sm text-amber-700 dark:text-amber-300">
                                Bu ana başlığa alt başlık ekleyemezsiniz çünkü
                                zaten içerik mevcut.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <CreateH2Form
                          onCreate={(title) => createH2(activeH1.id, title)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* CONTENTS */}
        <section className={sectionCard}>
          <div className="pointer-events-none absolute -inset-2 rounded-3xl opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br from-emerald-700/20 via-emerald-600/15 to-emerald-800/20" />

          <div className="relative z-10">
            <div className="font-bold mb-8 text-2xl flex items-center gap-4 text-gray-900 dark:text-white">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-800 flex items-center justify-center text-2xl text-white shadow-lg">
                📝
              </div>
              <div>
                <h2>İçerikler</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                  Doküman içeriklerini yönetin
                </p>
              </div>
            </div>

            {!currentHeadingId && (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <div className="text-6xl mb-4">📑</div>
                <p className="text-lg font-medium">Önce bir başlık seçin</p>
                <p className="text-sm">
                  İçerikleri görüntülemek için bir başlık seçin
                </p>
              </div>
            )}

            {currentHeadingId && (
              <>
                {selectedContent && (
                  <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-100/80 dark:from-blue-900/20 dark:to-indigo-900/20 border border-dashed border-blue-300/60 dark:border-blue-700/60 backdrop-blur-sm">
                    <div className="font-semibold mb-4 text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <span className="text-blue-600 dark:text-blue-400">
                        🖼️
                      </span>{" "}
                      Resim Yönetimi
                    </div>
                    <div className="p-4 rounded-xl bg-white/50 dark:bg-gray-800/30 border border-blue-200/50 dark:border-blue-800/50">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Önce resimlerinizi yükleyin, sonra içerik yazarken{" "}
                        <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">
                          &lt;--image--&gt;
                        </code>{" "}
                        ifadesi ile istediğiniz yere yerleştirin.
                      </p>
                      <ContentImageManager
                        key={selectedContent.id}
                        contentId={selectedContent.id}
                        onNotification={showNotification}
                      />
                    </div>
                  </div>
                )}

                <div className="grid gap-4">
                  {contents.map((c) => (
                    <div key={c.id} className={itemCard}>
                      <div className="flex items-center justify-between gap-4">
                        <button
                          className={cx(
                            "font-bold text-left flex-1 truncate text-lg transition-all duration-300",
                            selectedContent?.id === c.id
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-gray-800 dark:text-gray-200 hover:text-emerald-700 dark:hover:text-emerald-400"
                          )}
                          onClick={() =>
                            setSelectedContent(
                              selectedContent?.id === c.id ? null : c
                            )
                          }
                          title={c.body}
                        >
                          {c.body.substring(0, 50)}...
                        </button>

                        <div className="flex items-center gap-3">
                          <button
                            className={cx(
                              "px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200",
                              selectedContent?.id === c.id
                                ? "bg-blue-500 text-white"
                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                            )}
                            onClick={() =>
                              setSelectedContent(
                                selectedContent?.id === c.id ? null : c
                              )
                            }
                          >
                            🖼️ Resimler
                          </button>
                          <button
                            onClick={async () => {
                              const newBody = await showPrompt(
                                "İçerik Düzenle",
                                c.body,
                                "Yeni içerik:"
                              );
                              if (newBody !== null) {
                                ContentsApi.update(c.id, { body: newBody })
                                  .then(() => {
                                    if (currentHeadingId)
                                      fetchContentsByHeading(currentHeadingId);
                                    showNotification(
                                      "İçerik güncellendi",
                                      "success"
                                    );
                                  })
                                  .catch(() =>
                                    showNotification("Güncelleme hatası")
                                  );
                              }
                            }}
                            className="px-3 py-1.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 font-medium transition-all duration-200"
                          >
                            ✏️ Düzenle
                          </button>
                          <button
                            onClick={async () => {
                              const confirmed = await showConfirm(
                                "İçerik Sil",
                                "Bu içeriği silmek istediğinizden emin misiniz?"
                              );
                              if (confirmed) {
                                if (selectedContent?.id === c.id) {
                                  setSelectedContent(null);
                                }

                                ContentsApi.remove(c.id)
                                  .then(() => {
                                    if (currentHeadingId)
                                      fetchContentsByHeading(currentHeadingId);
                                    showNotification(
                                      "İçerik silindi",
                                      "success"
                                    );
                                  })
                                  .catch(() =>
                                    showNotification("Silme hatası")
                                  );
                              }
                            }}
                            className="px-3 py-1.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 font-medium transition-all duration-200"
                          >
                            🗑️ Sil
                          </button>
                        </div>
                      </div>
                      {c.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl">
                          {c.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-8">
              {(activeH1 || currentHeadingId) && contents.length === 0 && (
                <CreateContentForm
                  targetOptions={
                    currentHeadingId
                      ? // Eğer bir başlık seçildiyse sadece o başlığı göster
                        [
                          ...h1s
                            .filter((h) => h.id === currentHeadingId)
                            .map((h) => ({ id: h.id, label: `📄 ${h.title}` })),
                          ...h2s
                            .filter((h) => h.id === currentHeadingId)
                            .map((h) => ({ id: h.id, label: `📑 ${h.title}` })),
                        ]
                      : // Değilse tüm başlıkları göster ama mantığa göre filtrele
                        [
                          // Ana başlık seçildiyse ve alt başlık yoksa ana başlığı göster
                          ...(activeH1 && h2s.length === 0
                            ? [
                                {
                                  id: activeH1.id,
                                  label: `📄 ${activeH1.title}`,
                                },
                              ]
                            : []),
                          // Alt başlıklar varsa onları göster
                          ...h2s.map((h) => ({
                            id: h.id,
                            label: `📑 ${h.title}`,
                          })),
                        ]
                  }
                  onCreate={createContent}
                />
              )}
            </div>
          </div>
        </section>

        {/* ADMIN USERS */}
        <section className={sectionCard}>
          <div className="pointer-events-none absolute -inset-2 rounded-3xl opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br from-emerald-700/20 via-emerald-600/15 to-emerald-800/20" />

          <div className="relative z-10">
            <div className="font-bold mb-8 text-2xl flex items-center gap-4 text-gray-900 dark:text-white">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-800 flex items-center justify-center text-2xl text-white shadow-lg">
                👤
              </div>
              <div>
                <h2>Admin Kullanıcıları</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                  Admin kullanıcılarını yönetin
                </p>
              </div>
            </div>

            {admins.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <div className="text-6xl mb-4">👤</div>
                <p className="text-lg font-medium">Henüz admin kullanıcı yok</p>
                <p className="text-sm">İlk admin kullanıcıyı oluşturun</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {admins.map((a) => (
                  <div key={a.id} className={itemCard}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-bold text-left flex-1 truncate text-lg text-gray-800 dark:text-gray-200">
                        {a.email}
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          className="p-3 rounded-xl border border-gray-300/60 dark:border-gray-600/60 hover:border-emerald-600/80 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 hover:scale-105 transition-all duration-200"
                          onClick={() => changeAdminPassword(a.id)}
                          title="Şifre Değiştir"
                        >
                          🔒
                        </button>

                        <button
                          className="p-3 rounded-xl border border-gray-300/60 dark:border-gray-600/60 hover:border-rose-400/60 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:scale-105 transition-all duration-200"
                          onClick={() => deleteAdmin(a.id)}
                          title="Sil"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8">
              <CreateAdminForm
                onCreate={createAdmin}
                showNotification={showNotification}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
