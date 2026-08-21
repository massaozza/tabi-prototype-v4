import { useEffect, useRef, useState } from 'react';

export const MAX_PHOTOS = 10;

interface PhotoItem {
  id: string;
  status: 'uploading' | 'success' | 'error';
  previewUrl: string;
  publicUrl?: string;
  error?: string;
}

interface PhotoUploaderProps {
  onPhotosChange: (publicUrls: string[]) => void;
  onUploadingChange: (uploading: boolean) => void;
}

export default function PhotoUploader({
  onPhotosChange,
  onUploadingChange,
}: PhotoUploaderProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [tooManyError, setTooManyError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PhotoItem[]>([]);
  const idCounter = useRef(0);

  useEffect(() => {
    const current = photosRef.current;
    return () => {
      current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  const applyUpdate = (updater: (prev: PhotoItem[]) => PhotoItem[]) => {
    const next = updater(photosRef.current);
    photosRef.current = next;
    setPhotos(next);
    const publicUrls = next
      .filter((p) => p.status === 'success' && p.publicUrl)
      .map((p) => p.publicUrl as string);
    onPhotosChange(publicUrls);
    onUploadingChange(next.some((p) => p.status === 'uploading'));
  };

  const uploadFile = async (
    file: File
  ): Promise<{ publicUrl?: string; error?: string }> => {
    try {
      const res = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contentType: file.type, fileSize: file.size }),
      });
      const data = await res.json();
      if (!res.ok || !data.uploadUrl) {
        return { error: data.error || 'Failed to get upload URL' };
      }

      const putRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!putRes.ok) {
        return { error: 'Upload failed' };
      }
      return { publicUrl: data.publicUrl };
    } catch {
      return { error: 'Upload failed. Please try again.' };
    }
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setTooManyError('');

    const available = MAX_PHOTOS - photosRef.current.length;
    if (available <= 0) {
      setTooManyError(`You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }

    let selected = files;
    if (files.length > available) {
      const skipped = files.length - available;
      selected = files.slice(0, available);
      setTooManyError(
        `You can upload up to ${MAX_PHOTOS} photos. ${skipped} photo${
          skipped > 1 ? 's were' : ' was'
        } not added.`
      );
    }

    const newItems: PhotoItem[] = selected.map((file) => {
      idCounter.current += 1;
      return {
        id: String(idCounter.current),
        status: 'uploading',
        previewUrl: URL.createObjectURL(file),
      };
    });

    applyUpdate((prev) => [...prev, ...newItems]);

    newItems.forEach((item, idx) => {
      const file = selected[idx];
      uploadFile(file).then((result) => {
        applyUpdate((prev) =>
          prev.map((p) => {
            if (p.id !== item.id) return p;
            if (result.publicUrl) {
              return { ...p, status: 'success', publicUrl: result.publicUrl };
            }
            return { ...p, status: 'error', error: result.error };
          })
        );
      });
    });
  };

  const removePhoto = (id: string) => {
    applyUpdate((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        id="experience-photos"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="flex flex-wrap gap-3">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative w-24 h-24 rounded-md overflow-hidden border border-background-200 bg-background-100"
          >
            <img
              src={photo.previewUrl}
              alt="Upload preview"
              className="w-full h-full object-cover"
            />
            {photo.status === 'uploading' && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <i className="ri-loader-4-line animate-spin text-white text-xl"></i>
              </div>
            )}
            {photo.status === 'error' && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <i className="ri-error-warning-line text-red-400 text-xl"></i>
              </div>
            )}
            {photo.status !== 'uploading' && (
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
                aria-label="Remove photo"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            )}
          </div>
        ))}

        {photos.length < MAX_PHOTOS && (
          <label
            htmlFor="experience-photos"
            className="w-24 h-24 rounded-md border-2 border-dashed border-background-300 flex flex-col items-center justify-center gap-1 text-foreground-400 hover:border-primary-400 hover:text-primary-500 transition-colors cursor-pointer"
          >
            <i className="ri-image-add-line text-2xl"></i>
            <span className="text-xs whitespace-nowrap">Add photos</span>
          </label>
        )}
      </div>

      {tooManyError && (
        <p className="text-red-500 text-xs mt-2">{tooManyError}</p>
      )}

      <p className="text-foreground-400 text-xs mt-2">
        Up to {MAX_PHOTOS} photos ({photos.length}/{MAX_PHOTOS})
      </p>
    </div>
  );
}
