"use client";

import type React from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import type { UUID } from "../../shared/types/models";
import { ContentImagesApi } from "../../shared/api/admin";

interface ImagePlaceholder {
  index: number;
  url: string;
  alt: string;
  sortOrder: number;
  isValid?: boolean;
  file?: File;
  isUploading?: boolean;
  width?: number;
  height?: number;
}

interface ImageData {
  url: string;
  alt: string;
  sortOrder: number;
  file?: File;
  width?: number;
  height?: number;
}

interface ResizableImagePreviewProps {
  image: ImagePlaceholder;
  onSizeChange: (width: number, height: number) => void;
}

function ResizableImagePreview({
  image,
  onSizeChange,
}: ResizableImagePreviewProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: image.width || 300,
    height: image.height || 200,
  });
  const imageRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startDimensions = useRef({ width: 0, height: 0 });

  useEffect(() => {
    if (!isResizing) {
      setDimensions({
        width: image.width || 300,
        height: image.height || 200,
      });
    }
  }, [image.width, image.height, isResizing]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - startPos.current.x;
      const deltaY = e.clientY - startPos.current.y;

      const newWidth = Math.max(100, startDimensions.current.width + deltaX);
      const newHeight = Math.max(75, startDimensions.current.height + deltaY);

      setDimensions({ width: newWidth, height: newHeight });
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    if (!isResizing) return;

    setIsResizing(false);
    onSizeChange(dimensions.width, dimensions.height);

    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [
    isResizing,
    dimensions.width,
    dimensions.height,
    onSizeChange,
    handleMouseMove,
  ]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    startDimensions.current = { ...dimensions };
  };

  return (
    <div
      ref={imageRef}
      className="relative inline-block border-2 border-dashed border-blue-300 hover:border-blue-400 transition-colors"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      <img
        src={
          image.file
            ? URL.createObjectURL(image.file)
            : image.url || "/placeholder.svg"
        }
        alt={image.alt || `Resim ${image.index + 1}`}
        className="w-full h-full object-cover rounded"
        draggable={false}
        style={{
          userSelect: "none",
          pointerEvents: isResizing ? "none" : "auto",
        }}
      />

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize hover:bg-blue-600 transition-colors z-10"
        onMouseDown={handleMouseDown}
        title="Boyutu değiştirmek için sürükleyin"
        style={{
          userSelect: "none",
          touchAction: "none",
        }}
      >
        <div className="absolute inset-1 border-r border-b border-white opacity-70"></div>
      </div>

      {/* Size indicator */}
      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded pointer-events-none">
        {Math.round(dimensions.width)} × {Math.round(dimensions.height)}
      </div>

      {isResizing && (
        <div
          className="absolute inset-0 bg-transparent cursor-se-resize z-20"
          style={{ userSelect: "none" }}
        />
      )}
    </div>
  );
}

export default function CreateContentForm({
  targetOptions,
  onCreate,
}: {
  targetOptions: { id: UUID; label: string }[];
  onCreate: (
    headingId: UUID,
    body: string,
    images: ImageData[],
    description?: string
  ) => void;
}) {
  const [body, setBody] = useState(`# Merhaba Dünya

Bu bir **Markdown** içeriktir.

- Madde 1
- Madde 2

\`\`\`python
print("hello")
\`\`\`
`);
  const [target, setTarget] = useState<UUID | "">("");
  const [imagePlaceholders, setImagePlaceholders] = useState<
    ImagePlaceholder[]
  >([]);
  const [imagePreviewErrors, setImagePreviewErrors] = useState<{
    [key: number]: boolean;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    body?: string;
    target?: string;
  }>({});

  useEffect(() => {
    if (targetOptions[0]) setTarget(targetOptions[0].id);
  }, [targetOptions]);

  useEffect(() => {
    const regex = /<--image-->/g;
    const matches = [];
    let match;
    let index = 0;

    while ((match = regex.exec(body)) !== null) {
      const existingImg = imagePlaceholders[index];
      matches.push({
        index,
        url: existingImg?.url || "",
        alt: existingImg?.alt || "",
        sortOrder: index,
        isValid: existingImg?.isValid || false,
        width: existingImg?.width || 300,
        height: existingImg?.height || 200,
      });
      index++;
    }

    // Sadece placeholder sayısı değiştiyse state'i güncelle
    if (matches.length !== imagePlaceholders.length) {
      setImagePlaceholders(matches);
    }
  }, [body]);

  useEffect(() => {
    const errors: { body?: string; target?: string } = {};

    if (!body.trim()) {
      errors.body = "İçerik boş olamaz";
    } else if (body.trim().length < 10) {
      errors.body = "İçerik en az 10 karakter olmalı";
    }

    if (!target) {
      errors.target = "Bir başlık seçmelisiniz";
    }

    setFormErrors(errors);
  }, [body, target]);

  const updateImagePlaceholder = (
    index: number,
    field: "url" | "alt" | "width" | "height",
    value: string | number
  ) => {
    setImagePlaceholders((prev) =>
      prev.map((img) => {
        if (img.index === index) {
          const updated = { ...img, [field]: value };
          // URL validation
          if (field === "url") {
            updated.isValid = isValidImageUrl(value as string);
          }
          return updated;
        }
        return img;
      })
    );
  };

  const isValidImageUrl = (url: string): boolean => {
    if (!url) return false;
    try {
      new URL(url);
      return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
    } catch {
      return false;
    }
  };

  const handleImageError = (index: number) => {
    setImagePreviewErrors((prev) => ({ ...prev, [index]: true }));
  };

  const handleImageLoad = (index: number) => {
    setImagePreviewErrors((prev) => ({ ...prev, [index]: false }));
  };

  const removeImagePlaceholder = (index: number) => {
    const regex = /<--image-->/g;
    let match;
    let currentIndex = 0;
    let newBody = body;

    while ((match = regex.exec(body)) !== null) {
      if (currentIndex === index) {
        newBody =
          body.substring(0, match.index) +
          body.substring(match.index + match[0].length);
        break;
      }
      currentIndex++;
    }

    setBody(newBody);
  };

  const insertImagePlaceholder = () => {
    const cursorPos =
      (document.activeElement as HTMLTextAreaElement)?.selectionStart ||
      body.length;
    const newBody =
      body.slice(0, cursorPos) + "<--image-->" + body.slice(cursorPos);
    setBody(newBody);
  };

  const handleFileSelect = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Lütfen sadece resim dosyası seçin");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("Dosya boyutu 5MB'dan küçük olmalı");
        return;
      }

      setImagePlaceholders((prev) =>
        prev.map((img) =>
          img.index === index
            ? { ...img, file, url: "", isValid: true, isUploading: false }
            : img
        )
      );
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    try {
      const result = await ContentImagesApi.upload(
        file,
        window.crypto.randomUUID(), // Generate a proper UUID for content_id
        "", // alt text (will be set later)
        0 // sort_order
      );
      return result.url;
    } catch (error) {
      console.error("[v0] Upload failed:", error);
      throw new Error(
        `Upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    if (!body.trim() || !target) return;

    setIsSubmitting(true);

    try {
      const processedImages: ImageData[] = [];

      for (const img of imagePlaceholders) {
        if (img.file) {
          // Store file data for later upload after content creation
          processedImages.push({
            url: "", // Will be set after upload
            alt: img.alt || "",
            sortOrder: img.sortOrder,
            file: img.file, // Pass file to onCreate
            width: img.width || 300,
            height: img.height || 200,
          });
        } else if (img.url && img.isValid) {
          // Use URL-based image
          processedImages.push({
            url: img.url,
            alt: img.alt || "",
            sortOrder: img.sortOrder,
            width: img.width || 300,
            height: img.height || 200,
          });
        }
      }

      await onCreate(target as UUID, body, processedImages);
      setBody(`# Yeni İçerik

Bu bir **Markdown** içeriktir.

- Madde 1
- Madde 2
`);
      setImagePlaceholders([]);
      setShowPreview(false);
    } catch (error) {
      console.error("[v0] Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasValidationErrors = Object.keys(formErrors).length > 0;
  const hasInvalidImages = imagePlaceholders.some(
    (img) => img.url && !img.isValid
  );
  const isFormValid = !hasValidationErrors && !hasInvalidImages;

  const handleImageSizeChange = (
    index: number,
    width: number,
    height: number
  ) => {
    setImagePlaceholders((prev) =>
      prev.map((img) => (img.index === index ? { ...img, width, height } : img))
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-gray-50/80 to-gray-100/80 dark:from-gray-800/50 dark:to-gray-900/50 border border-dashed border-gray-300/60 dark:border-gray-700/60 backdrop-blur-sm shadow-lg"
    >
      <div className="font-semibold mb-6 text-lg text-gray-700 dark:text-gray-300 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center text-white text-sm">
          +
        </div>
        <div>
          <h3>Yeni İçerik Ekle</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-0.5">
            Markdown formatında içerik oluşturun ve resimler ekleyin
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <span className="text-emerald-600 dark:text-emerald-400">📑</span>
            Hedef Başlık
          </label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as UUID)}
            className={`w-full rounded-xl border px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 text-gray-900 dark:text-white ${
              formErrors.target
                ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/20"
                : "border-gray-300/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/80"
            }`}
          >
            <option value="">Bir başlık seçin...</option>
            {targetOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {formErrors.target && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {formErrors.target}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">📝</span>
              İçerik (Markdown)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={insertImagePlaceholder}
                className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors font-medium"
              >
                🖼️ Resim Ekle
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-900/50 transition-colors font-medium"
              >
                {showPreview ? "📝 Düzenle" : "👁️ Önizle"}
              </button>
            </div>
          </div>

          {!showPreview ? (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="# Başlık

Markdown içeriğinizi yazın...

- Liste öğesi 1
- Liste öğesi 2

Resim eklemek için **Resim Ekle** butonunu kullanın veya `<--image-->` yazın."
              className={`w-full rounded-xl border px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono resize-none ${
                formErrors.body
                  ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/20"
                  : "border-gray-300/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/80"
              }`}
            />
          ) : (
            <div className="w-full min-h-[240px] rounded-xl border border-gray-300/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/80 px-4 py-3 text-sm text-gray-900 dark:text-white">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {body.split("\n").map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {line.replace(/<--image-->/g, "🖼️ [Resim]")}
                  </div>
                ))}
              </div>
            </div>
          )}

          {formErrors.body && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {formErrors.body}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{body.length} karakter</span>
            <span>{imagePlaceholders.length} resim placeholder'ı</span>
          </div>
        </div>

        {imagePlaceholders.length > 0 && (
          <div className="space-y-4 mt-6 p-4 rounded-xl bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-200/30 dark:border-blue-800/30">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">🖼️</span>
                Resim Bilgileri
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-100/50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
                {
                  imagePlaceholders.filter((img) => img.url && img.isValid)
                    .length
                }{" "}
                / {imagePlaceholders.length} hazır
              </div>
            </div>

            <div className="space-y-3">
              {imagePlaceholders.map((img, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-white/70 dark:bg-gray-800/50 border border-blue-200/50 dark:border-blue-800/50 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                        {idx + 1}
                      </div>
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        Resim #{idx + 1}
                      </span>
                      {img.isValid && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                          ✓ Geçerli
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImagePlaceholder(idx)}
                      className="text-red-500 hover:text-red-700 text-sm px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
                    >
                      🗑️ Sil
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-3">
                      <div className="relative">
                        <input
                          type="url"
                          placeholder="https://example.com/image.jpg"
                          value={img.url}
                          onChange={(e) =>
                            updateImagePlaceholder(idx, "url", e.target.value)
                          }
                          disabled={!!img.file}
                          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 ${
                            img.file
                              ? "bg-gray-100 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                              : img.url && !img.isValid
                              ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/20"
                              : img.isValid
                              ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/20"
                              : "border-blue-300/60 dark:border-blue-700/60 bg-white/90 dark:bg-gray-800/80"
                          }`}
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            veya
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileSelect(idx, e)}
                            className="hidden"
                            id={`file-${idx}`}
                          />
                          <label
                            htmlFor={`file-${idx}`}
                            className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors cursor-pointer font-medium"
                          >
                            📁 Bilgisayardan Seç
                          </label>
                          {img.file && (
                            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                              ✓ {img.file.name}
                            </span>
                          )}
                        </div>
                        {img.url && !img.isValid && !img.file && (
                          <div className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                            <span>⚠️</span>
                            Geçerli bir resim URL'si girin (.jpg, .png, .gif,
                            .webp, .svg)
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Resim açıklaması (SEO ve erişilebilirlik için önerilir)"
                        value={img.alt}
                        onChange={(e) =>
                          updateImagePlaceholder(idx, "alt", e.target.value)
                        }
                        className="w-full rounded-lg border border-blue-300/60 dark:border-blue-700/60 bg-white/90 dark:bg-gray-800/80 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                      />
                    </div>

                    <div className="lg:col-span-1">
                      {((img.url && img.isValid) || img.file) && (
                        <div className="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex justify-center">
                          {img.isUploading ? (
                            <div className="w-full h-full flex items-center justify-center text-blue-600 dark:text-blue-400 aspect-video">
                              <div className="text-center">
                                <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
                                <div className="text-xs">Yükleniyor...</div>
                              </div>
                            </div>
                          ) : !imagePreviewErrors[idx] ? (
                            <ResizableImagePreview
                              image={img}
                              onSizeChange={(width, height) =>
                                handleImageSizeChange(idx, width, height)
                              }
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600 text-xs aspect-video">
                              <div className="text-center">
                                <div className="text-2xl mb-1">⚠️</div>
                                <div>Resim yüklenemedi</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {(!img.url || !img.isValid) && !img.file && (
                        <div className="aspect-video rounded-lg bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                          <div className="text-center text-gray-400 dark:text-gray-600 text-xs">
                            <div className="text-2xl mb-1">📷</div>
                            <div>Önizleme</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50/50 to-green-50/50 dark:from-emerald-900/10 dark:to-green-900/10 border border-emerald-200/30 dark:border-emerald-800/30">
          <div className="text-sm text-emerald-800 dark:text-emerald-200">
            <div className="font-medium mb-2 flex items-center gap-2">
              <span>💡</span>
              Kullanım İpuçları
            </div>
            <ul className="space-y-1 text-xs text-emerald-700 dark:text-emerald-300">
              <li>• Markdown formatını kullanarak zengin içerik oluşturun</li>
              <li>
                • Resim eklemek için{" "}
                <code className="bg-emerald-200 dark:bg-emerald-800 px-1 rounded">
                  &lt;--image--&gt;
                </code>{" "}
                ifadesini kullanın
              </li>
              <li>• Resimler içerikte sırasıyla görüntülenecektir</li>
              <li>• Alt metin eklemek SEO ve erişilebilirlik için önemlidir</li>
            </ul>
          </div>
        </div>

        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className={`w-full px-6 py-4 rounded-xl font-semibold text-white shadow-lg transition-all duration-300 transform ${
            isSubmitting
              ? "bg-gray-400 cursor-not-allowed"
              : !isFormValid
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          }`}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>İçerik Ekleniyor...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span>✨</span>
              <span>İçerik Ekle</span>
              {imagePlaceholders.length > 0 && (
                <span className="text-xs opacity-80">
                  (
                  {
                    imagePlaceholders.filter((img) => img.url && img.isValid)
                      .length
                  }{" "}
                  resimle)
                </span>
              )}
            </div>
          )}
        </button>
      </div>
    </form>
  );
}
