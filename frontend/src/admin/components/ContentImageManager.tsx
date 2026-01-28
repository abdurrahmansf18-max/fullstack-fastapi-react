"use client";

import React from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import { ContentImagesApi } from "../../shared/api/admin";
import type { UUID, ContentImage } from "../../shared/types/models";
import type { ContentImageCreateDTO } from "../../shared/types/dto";

interface ContentImageManagerProps {
  contentId: UUID;
  onNotification: (
    message: string,
    type: "error" | "success" | "warning"
  ) => void;
}

interface ResizableImageProps {
  image: ContentImage;
  onSizeChange: (width: number, height: number) => void;
}

function ResizableImage({ image, onSizeChange }: ResizableImageProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: image.width || 200,
    height: image.height || 150,
  });
  const imageRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startDimensions = useRef({ width: 0, height: 0 });
  const manuallyResized = useRef(false);

  useEffect(() => {
    if (!isResizing && !manuallyResized.current) {
      console.log("[v0] Syncing dimensions from database:", {
        imageId: image.id,
        dbWidth: image.width,
        dbHeight: image.height,
        currentWidth: dimensions.width,
        currentHeight: dimensions.height,
      });

      const newDimensions = {
        width: image.width || 200,
        height: image.height || 150,
      };

      // Always sync with database values when not manually resizing
      setDimensions(newDimensions);
    }

    // Reset manual resize flag when image dimensions change
    if (
      image.width !== dimensions.width ||
      image.height !== dimensions.height
    ) {
      manuallyResized.current = false;
    }
  }, [image.width, image.height, image.id, isResizing]);

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
    manuallyResized.current = true;
    console.log("[v0] Manual resize completed:", {
      width: dimensions.width,
      height: dimensions.height,
    });
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
      className="relative inline-block border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      <img
        src={image.url || "/placeholder.svg"}
        alt={image.alt || "Content image"}
        className="w-full h-full object-cover rounded"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/broken-image.jpg";
        }}
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

export default function ContentImageManager({
  contentId,
  onNotification,
}: ContentImageManagerProps) {
  const [images, setImages] = useState<ContentImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newImage, setNewImage] = useState({
    url: "",
    alt: "",
    sort_order: 0,
    width: 200,
    height: 150,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchImages = async () => {
    try {
      setLoading(true);
      console.log("[v0] Fetching images for contentId:", contentId);
      console.log("[v0] API call details:", {
        endpoint: `/admin/content-images/${contentId}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
        },
      });
      const data = await ContentImagesApi.list(contentId);
      console.log("[v0] Fetched images:", data);
      console.log(
        "[v0] Response type:",
        typeof data,
        "Array?",
        Array.isArray(data)
      );
      setImages(data);
    } catch (error) {
      console.log("[v0] Fetch images error:", error);
      if (error instanceof Error) {
        console.log("[v0] Error message:", error.message);
        console.log("[v0] Error stack:", error.stack);
      }
      onNotification("Resimler yüklenirken hata oluştu", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setImages([]);
    setNewImage({ url: "", alt: "", sort_order: 0, width: 200, height: 150 });
    setSelectedFile(null);
    fetchImages();
  }, [contentId]);

  const handleAddImage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedFile) {
      try {
        setUploading(true);
        console.log("[v0] Starting file upload:", {
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          contentId: contentId,
        });

        const uploadedImage = await ContentImagesApi.upload(
          selectedFile,
          contentId,
          newImage.alt || undefined,
          newImage.sort_order,
          newImage.width,
          newImage.height
        );

        console.log("[v0] Upload successful:", uploadedImage);

        setSelectedFile(null);
        setNewImage({
          url: "",
          alt: "",
          sort_order: 0,
          width: 200,
          height: 150,
        });

        const fileInput = document.getElementById(
          "file-input"
        ) as HTMLInputElement;
        if (fileInput) {
          fileInput.value = "";
        }

        await fetchImages();
        onNotification("Resim başarıyla yüklendi", "success");
      } catch (error) {
        console.error("[v0] Upload failed:", error);
        onNotification(
          `Resim yüklenirken hata oluştu: ${
            error instanceof Error ? error.message : "Bilinmeyen hata"
          }`,
          "error"
        );
      } finally {
        setUploading(false);
      }
    } else if (newImage.url.trim()) {
      try {
        const createData: ContentImageCreateDTO = {
          content_id: contentId,
          url: newImage.url,
          alt: newImage.alt || undefined,
          sort_order: newImage.sort_order,
          width: newImage.width,
          height: newImage.height,
        };

        await ContentImagesApi.create(createData);

        setNewImage({
          url: "",
          alt: "",
          sort_order: 0,
          width: 200,
          height: 150,
        });
        await fetchImages();
        onNotification("Resim başarıyla eklendi", "success");
      } catch (error) {
        onNotification("Resim eklenirken hata oluştu", "error");
      }
    }
  };

  const handleDeleteImage = async (imageId: UUID) => {
    try {
      await ContentImagesApi.remove(imageId);
      await fetchImages();
      onNotification("Resim başarıyla silindi", "success");
    } catch (error) {
      onNotification("Resim silinirken hata oluştu", "error");
    }
  };

  const handleUpdateSortOrder = async (imageId: UUID, newSortOrder: number) => {
    try {
      await ContentImagesApi.update(imageId, { sort_order: newSortOrder });
      await fetchImages();
      onNotification("Sıralama güncellendi", "success");
    } catch (error) {
      onNotification("Sıralama güncellenirken hata oluştu", "error");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];

      if (!file.type.startsWith("image/")) {
        onNotification("Lütfen sadece resim dosyası seçin", "error");
        e.target.value = "";
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        onNotification("Dosya boyutu 10MB'dan küçük olmalı", "error");
        e.target.value = "";
        return;
      }

      console.log("[v0] File selected:", {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      setSelectedFile(file);
      setNewImage((prev) => ({ ...prev, url: "" }));
    }
  };

  const handleImageSizeChange = async (
    imageId: UUID,
    width: number,
    height: number
  ) => {
    try {
      console.log("[v0] Updating image size:", { imageId, width, height });
      await ContentImagesApi.update(imageId, { width, height });
      console.log("[v0] API update successful");

      setImages((prevImages) =>
        prevImages.map((img) =>
          img.id === imageId ? { ...img, width, height } : img
        )
      );

      onNotification("Resim boyutu güncellendi", "success");
    } catch (error) {
      console.log("[v0] API update failed:", error);
      onNotification("Resim boyutu güncellenirken hata oluştu", "error");
      await fetchImages();
    }
  };

  return (
    <div className="space-y-4">
      <div className="font-semibold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <span className="text-blue-600 dark:text-blue-400">🖼️</span> İçerik
        Resimleri
      </div>

      <form
        onSubmit={handleAddImage}
        className="space-y-3 p-4 rounded-xl bg-white/70 dark:bg-gray-800/70 border border-gray-200/50 dark:border-gray-700/50"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <input
              type="url"
              placeholder="Resim URL'si"
              value={newImage.url}
              onChange={(e) => {
                setNewImage((prev) => ({ ...prev, url: e.target.value }));
                if (e.target.value.trim()) {
                  setSelectedFile(null);
                }
              }}
              className="w-full rounded-xl border border-gray-300/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/80 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-gray-900 dark:text-white"
            />

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                veya
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer transition-colors text-sm font-medium"
              >
                📁 Bilgisayardan Seç
              </label>
              {selectedFile && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  {selectedFile.name}
                </span>
              )}
            </div>

            <input
              type="text"
              placeholder="Alt metin (opsiyonel)"
              value={newImage.alt}
              onChange={(e) =>
                setNewImage((prev) => ({ ...prev, alt: e.target.value }))
              }
              className="w-full rounded-xl border border-gray-300/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/80 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-gray-900 dark:text-white"
            />

            <input
              type="number"
              placeholder="Sıra numarası"
              value={newImage.sort_order}
              onChange={(e) =>
                setNewImage((prev) => ({
                  ...prev,
                  sort_order: Number.parseInt(e.target.value) || 0,
                }))
              }
              className="w-full rounded-xl border border-gray-300/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/80 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-gray-900 dark:text-white"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Genişlik (px)"
                value={newImage.width}
                onChange={(e) =>
                  setNewImage((prev) => ({
                    ...prev,
                    width: Number.parseInt(e.target.value) || 200,
                  }))
                }
                className="w-full rounded-xl border border-gray-300/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/80 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-gray-900 dark:text-white"
              />
              <input
                type="number"
                placeholder="Yükseklik (px)"
                value={newImage.height}
                onChange={(e) =>
                  setNewImage((prev) => ({
                    ...prev,
                    height: Number.parseInt(e.target.value) || 150,
                  }))
                }
                className="w-full rounded-xl border border-gray-300/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-800/80 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="lg:col-span-1">
            {((newImage.url.trim() && isValidImageUrl(newImage.url)) ||
              selectedFile) && (
              <div className="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex justify-center">
                <div
                  className="relative inline-block border-2 border-dashed border-blue-300 hover:border-blue-400 transition-colors"
                  style={{ width: newImage.width, height: newImage.height }}
                >
                  <img
                    src={
                      selectedFile
                        ? URL.createObjectURL(selectedFile)
                        : newImage.url
                    }
                    alt={newImage.alt || "Yeni resim önizlemesi"}
                    className="w-full h-full object-cover rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                    draggable={false}
                    style={{ userSelect: "none" }}
                  />

                  {/* Resize handle for preview before upload */}
                  <button
                    type="button"
                    className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize hover:bg-blue-600 transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const startW = newImage.width;
                      const startH = newImage.height;
                      const move = (me: MouseEvent) => {
                        const w = Math.max(100, startW + (me.clientX - startX));
                        const h = Math.max(75, startH + (me.clientY - startY));
                        setNewImage((p) => ({ ...p, width: w, height: h }));
                      };
                      const up = () => {
                        document.removeEventListener("mousemove", move);
                        document.removeEventListener("mouseup", up);
                      };
                      document.addEventListener("mousemove", move);
                      document.addEventListener("mouseup", up);
                    }}
                    title="Boyutu değiştirmek için sürükleyin"
                  />

                  {/* Size indicator */}
                  <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded pointer-events-none">
                    {newImage.width} × {newImage.height}
                  </div>
                </div>
              </div>
            )}
            {(!newImage.url.trim() || !isValidImageUrl(newImage.url)) &&
              !selectedFile && (
                <div className="aspect-video rounded-lg bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                  <div className="text-center text-gray-400 dark:text-gray-600 text-xs">
                    <div className="text-2xl mb-1">📷</div>
                    <div>Önizleme</div>
                  </div>
                </div>
              )}
          </div>
        </div>

        <button
          type="submit"
          disabled={(!newImage.url.trim() && !selectedFile) || uploading}
          className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none"
        >
          {uploading ? "Yükleniyor..." : "Resim Ekle"}
        </button>
      </form>

      {loading ? (
        <div className="text-center py-4 text-gray-500">Yükleniyor...</div>
      ) : images.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          Henüz resim eklenmemiş
        </div>
      ) : (
        <div className="space-y-6">
          {images.map((image) => (
            <div
              key={image.id}
              className="p-4 rounded-xl bg-white/70 dark:bg-gray-800/70 border border-gray-200/50 dark:border-gray-700/50"
            >
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white break-words">
                      {image.alt || "Alt metin yok"}
                    </div>
                    <div className="text-xs text-gray-500 break-all leading-relaxed max-w-full">
                      {image.url}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <input
                      type="number"
                      value={image.sort_order}
                      onChange={(e) =>
                        handleUpdateSortOrder(
                          image.id,
                          Number.parseInt(e.target.value) || 0
                        )
                      }
                      className="w-16 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      title="Sıra numarası"
                    />
                    <button
                      onClick={() => handleDeleteImage(image.id)}
                      className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors whitespace-nowrap"
                    >
                      Sil
                    </button>
                  </div>
                </div>

                <div className="flex justify-center">
                  <ResizableImage
                    image={image}
                    onSizeChange={(width, height) =>
                      handleImageSizeChange(image.id, width, height)
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper function to validate image URLs
function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
  } catch {
    return false;
  }
}
