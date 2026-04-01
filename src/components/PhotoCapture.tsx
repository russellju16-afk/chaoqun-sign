"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/image-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhotoItem {
  /** Unique identifier generated at capture time. */
  id: string;
  /** Original (compressed) file ready for upload. */
  file: File;
  /** Object URL for preview rendering — revoked on unmount or deletion. */
  preview: string;
}

export interface PhotoCaptureProps {
  /** Maximum number of photos allowed. Defaults to 3. */
  maxPhotos?: number;
  /** Called each time the photos array changes. */
  onPhotosChange?: (photos: PhotoItem[]) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PhotoCapture({
  maxPhotos = 3,
  onPhotosChange,
  className,
}: PhotoCaptureProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  // Keep a ref in sync with photos state so async handlers can read the latest
  // count without a stale closure or extra useEffect dependencies.
  const photosRef = useRef<PhotoItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const updatePhotos = useCallback(
    (updater: (prev: PhotoItem[]) => PhotoItem[]) => {
      setPhotos((prev) => {
        const next = updater(prev);
        photosRef.current = next;
        return next;
      });
    },
    [],
  );

  // Notify parent whenever photos change.
  useEffect(() => {
    onPhotosChange?.(photos);
  }, [photos, onPhotosChange]);

  // Revoke all object URLs on unmount to avoid memory leaks.
  // The ref is used so the cleanup captures the latest array without needing
  // photos in the dependency array (which would run cleanup too early).
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);

      // Reset the input so the same file can be chosen again if needed.
      if (inputRef.current) inputRef.current.value = "";

      if (files.length === 0) return;

      // Read the current count synchronously from the ref to determine how
      // many slots remain before we kick off async compression work.
      const slotsAvailable = maxPhotos - photosRef.current.length;
      if (slotsAvailable <= 0) return;

      const batch = files.slice(0, slotsAvailable);

      // Compress each selected file in parallel then build PhotoItem objects.
      const newItems: PhotoItem[] = await Promise.all(
        batch.map(async (file) => {
          const compressed = await compressImage(file);
          const compressedFile = new File([compressed], file.name, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          const preview = URL.createObjectURL(compressedFile);
          return { id: generateId(), file: compressedFile, preview };
        }),
      );

      // After awaiting, re-check available slots in case the user deleted a
      // photo while compression was in progress, then merge.
      updatePhotos((prev) => {
        const slots = maxPhotos - prev.length;
        if (slots <= 0) {
          // Revoke URLs for items we cannot store.
          newItems.forEach((item) => URL.revokeObjectURL(item.preview));
          return prev;
        }
        return [...prev, ...newItems.slice(0, slots)];
      });
    },
    [maxPhotos, updatePhotos],
  );

  const handleDelete = useCallback(
    (id: string) => {
      updatePhotos((prev) => {
        const target = prev.find((p) => p.id === id);
        if (target) URL.revokeObjectURL(target.preview);
        return prev.filter((p) => p.id !== id);
      });
    },
    [updatePhotos],
  );

  const canAddMore = photos.length < maxPhotos;

  return (
    <div className={className}>
      {/* Counter label */}
      <p className="mb-2 text-sm text-gray-500">
        已拍 {photos.length}/{maxPhotos} 张
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {/* Photo preview cards */}
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative aspect-square overflow-hidden rounded-xl shadow-md"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.preview}
              alt="已拍照片"
              className="h-full w-full object-cover"
            />

            {/* Delete button (top-right corner) */}
            <button
              type="button"
              onClick={() => handleDelete(photo.id)}
              aria-label="删除照片"
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 active:scale-95"
            >
              {/* X icon — inline SVG, no icon library */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}

        {/* Add-photo tile — hidden once the limit is reached */}
        {canAddMore && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label="添加照片"
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-500 active:scale-95"
          >
            {/* Camera icon — inline SVG */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
              aria-hidden="true"
            >
              {/* Body */}
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              {/* Lens */}
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className="text-xs font-medium">添加照片</span>
          </button>
        )}
      </div>

      {/*
        Hidden file input.
        - accept="image/*"  → filters to images in the picker
        - capture="environment" → on mobile opens the rear-facing camera directly
      */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFileChange}
      />
    </div>
  );
}
