import { useEffect, useRef, useState } from 'react';

export const MAX_VIDEOS = 2;

interface VideoItem {
  id: string;
  status: 'uploading' | 'success' | 'error';
  previewUrl: string;
  publicUrl?: string;
  error?: string;
}

interface VideoUploaderProps {
  onVideosChange: (publicUrls: string[]) => void;
  onUploadingChange: (uploading: boolean) => void;
}

export default function VideoUploader({
  onVideosChange,
  onUploadingChange,
}: VideoUploaderProps) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [tooManyError, setTooManyError] = useState('');
  const videosRef = useRef<VideoItem[]>([]);
  const idCounter = useRef(0);

  useEffect(() => {
    const current = videosRef.current;
    return () => {
      current.forEach((v) => URL.revokeObjectURL(v.previewUrl));
    };
  }, []);

  const applyUpdate = (updater: (prev: VideoItem[]) => VideoItem[]) => {
    const next = updater(videosRef.current);
    videosRef.current = next;
    setVideos(next);
    const publicUrls = next
      .filter((v) => v.status === 'success' && v.publicUrl)
      .map((v) => v.publicUrl as string);
    onVideosChange(publicUrls);
    onUploadingChange(next.some((v) => v.status === 'uploading'));
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
        return { error: data.error || '動画のアップロード準備に失敗しました' };
      }

      const putRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!putRes.ok) {
        return { error: 'アップロードに失敗しました' };
      }
      return { publicUrl: data.publicUrl };
    } catch {
      return { error: 'アップロードに失敗しました。もう一度お試しください。' };
    }
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setTooManyError('');

    const available = MAX_VIDEOS - videosRef.current.length;
    if (available <= 0) {
      setTooManyError(`動画は最大${MAX_VIDEOS}本までアップロードできます。`);
      return;
    }

    let selected = files;
    if (files.length > available) {
      selected = files.slice(0, available);
      setTooManyError(`動画は最大${MAX_VIDEOS}本までアップロードできます。`);
    }

    const newItems: VideoItem[] = selected.map((file) => {
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
          prev.map((v) => {
            if (v.id !== item.id) return v;
            if (result.publicUrl) {
              return { ...v, status: 'success', publicUrl: result.publicUrl };
            }
            return { ...v, status: 'error', error: result.error };
          })
        );
      });
    });
  };

  const removeVideo = (id: string) => {
    applyUpdate((prev) => {
      const target = prev.find((v) => v.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((v) => v.id !== id);
    });
  };

  return (
    <div>
      <input
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        multiple
        id="experience-videos"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="flex flex-wrap gap-3">
        {videos.map((video) => (
          <div
            key={video.id}
            className="relative w-32 h-24 rounded-md overflow-hidden border border-background-200 bg-background-900"
          >
            <video src={video.previewUrl} className="w-full h-full object-cover" muted />
            {video.status === 'uploading' && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <i className="ri-loader-4-line animate-spin text-white text-xl"></i>
              </div>
            )}
            {video.status === 'error' && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <i className="ri-error-warning-line text-red-400 text-xl"></i>
              </div>
            )}
            {video.status !== 'uploading' && (
              <button
                type="button"
                onClick={() => removeVideo(video.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
                aria-label="動画を削除"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            )}
          </div>
        ))}

        {videos.length < MAX_VIDEOS && (
          <label
            htmlFor="experience-videos"
            className="w-32 h-24 rounded-md border-2 border-dashed border-background-300 flex flex-col items-center justify-center gap-1 text-foreground-400 hover:border-primary-400 hover:text-primary-500 transition-colors cursor-pointer"
          >
            <i className="ri-video-add-line text-2xl"></i>
            <span className="text-xs whitespace-nowrap">動画を追加</span>
          </label>
        )}
      </div>

      {tooManyError && <p className="text-red-500 text-xs mt-2">{tooManyError}</p>}

      <p className="text-foreground-400 text-xs mt-2">
        動画は最大{MAX_VIDEOS}本まで（{videos.length}/{MAX_VIDEOS}）・1本あたり最大100MB
      </p>
    </div>
  );
}
