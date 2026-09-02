import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import CreatorNavbar from '@/components/feature/CreatorNavbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/context/AuthContext';

// TABI 3.0：日本人が慣れ親しんだ「旅行記」形式（フォートラベル等を参考にした、
// 時系列の自由記述＋写真）で投稿してもらい、AIが裏側で解析して、TABIの
// 構造化データ（GUIDE または Recommended Trip）に自動変換する投稿フォーム。
//
// 構造化されたフォーム（GUIDE投稿・手動旅程作成）とは違い、投稿者は
// 「いつも通りブログを書くだけ」で良い、というのが最大の狙い。

interface PhotoItem {
  id: string;
  status: 'uploading' | 'success' | 'error';
  previewUrl: string;
  publicUrl?: string;
  caption: string;
  error?: string;
}

const MAX_PHOTOS = 10;

const inputClass =
  'w-full bg-background-50 border border-background-200 rounded-md px-3.5 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all';

export default function WriteTravelogueePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [title, setTitle] = useState('');
  const [bodyJa, setBodyJa] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const photosRef = useRef<PhotoItem[]>([]);
  const idCounter = useRef(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ contentType: 'guide' | 'trip'; id: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const current = photosRef.current;
    return () => {
      current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  if (loading || !user) {
    return null;
  }

  const applyPhotosUpdate = (updater: (prev: PhotoItem[]) => PhotoItem[]) => {
    const next = updater(photosRef.current);
    photosRef.current = next;
    setPhotos(next);
  };

  const uploadFile = async (file: File): Promise<{ publicUrl?: string; error?: string }> => {
    try {
      const res = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contentType: file.type, fileSize: file.size }),
      });
      const data = await res.json();
      if (!res.ok || !data.uploadUrl) {
        return { error: data.error || 'アップロードに失敗しました' };
      }
      const putRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!putRes.ok) return { error: 'アップロードに失敗しました' };
      return { publicUrl: data.publicUrl };
    } catch {
      return { error: 'アップロードに失敗しました。もう一度お試しください。' };
    }
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const available = MAX_PHOTOS - photosRef.current.length;
    if (available <= 0) return;
    const files = Array.from(fileList).slice(0, available);

    const newItems: PhotoItem[] = files.map((file) => {
      idCounter.current += 1;
      return {
        id: String(idCounter.current),
        status: 'uploading',
        previewUrl: URL.createObjectURL(file),
        caption: '',
      };
    });
    applyPhotosUpdate((prev) => [...prev, ...newItems]);

    newItems.forEach((item, idx) => {
      uploadFile(files[idx]).then((result) => {
        applyPhotosUpdate((prev) =>
          prev.map((p) => {
            if (p.id !== item.id) return p;
            if (result.publicUrl) return { ...p, status: 'success', publicUrl: result.publicUrl };
            return { ...p, status: 'error', error: result.error };
          })
        );
      });
    });
  };

  const updateCaption = (id: string, caption: string) => {
    applyPhotosUpdate((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));
  };

  const removePhoto = (id: string) => {
    applyPhotosUpdate((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const photosUploading = photos.some((p) => p.status === 'uploading');
  const canSubmit = title.trim() !== '' && bodyJa.trim() !== '' && !photosUploading && !submitting;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/parse-travelogue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          bodyJa: bodyJa.trim(),
          authorName: user.displayName,
          photos: photos
            .filter((p) => p.status === 'success' && p.publicUrl)
            .map((p) => ({ url: p.publicUrl, caption: p.caption.trim() })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '解析に失敗しました');
      }
      setResult({ contentType: data.contentType, id: data.id });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '解析に失敗しました。もう一度お試しください。'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <main className="min-h-screen bg-background-50">
        <CreatorNavbar />
        <section className="py-20 px-6 md:px-10 text-center">
          <div className="max-w-lg mx-auto">
            <span className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-6">
              <i className="ri-checkbox-circle-fill text-3xl"></i>
            </span>
            <h1 className="font-heading font-bold text-2xl text-foreground-900 mb-3">
              投稿が完了しました！
            </h1>
            <p className="text-foreground-600 text-sm mb-8">
              あなたの旅行記を解析し、
              {result.contentType === 'trip' ? 'おすすめ旅程（Trip）' : 'スポットガイド（Guide）'}
              として自動的に整理しました。AIによる英訳も完了しています。
            </p>
            <div className="flex items-center justify-center gap-3">
              <a
                href={
                  result.contentType === 'trip' ? '/creators/dashboard' : `/guides/${result.id}`
                }
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
              >
                {result.contentType === 'trip' ? 'マイページで確認する' : '仕上がりを見る'}
              </a>
              <a
                href="/creators"
                className="inline-flex items-center gap-2 bg-background-100 hover:bg-background-200 text-foreground-800 font-semibold text-sm px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
              >
                トップに戻る
              </a>
            </div>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background-50">
      <CreatorNavbar />

      <section className="bg-foreground-900 pt-12 pb-10 px-6 md:px-10">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-400 mb-3">
            旅行記を書く
          </span>
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-white leading-tight mb-3">
            いつも通りに、書くだけでいい
          </h1>
          <p className="text-white/60 text-sm max-w-md mx-auto leading-relaxed">
            タイトルと本文を自由に書き、写真を添えてください。あとはAIが
            自動で読み解き、TABIのガイドや旅程として整理します。
          </p>
        </div>
      </section>

      <section className="py-10 px-6 md:px-10">
        <div className="max-w-2xl mx-auto">
          <div className="bg-background-50 border border-background-200 rounded-xl p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block font-heading font-semibold text-sm text-foreground-700 mb-2">
                  タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例：太平洋岸「津軽」②「聖地巡り」ローカル路線バスの旅"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block font-heading font-semibold text-sm text-foreground-700 mb-2">
                  本文 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={bodyJa}
                  onChange={(e) => setBodyJa(e.target.value)}
                  rows={14}
                  maxLength={8000}
                  placeholder="いつものように、旅の様子を自由に書いてください。時系列で、感じたこと・訪れた場所・お店の様子など、思うままにどうぞ。"
                  className={`${inputClass} resize-none leading-relaxed`}
                />
                <p className="text-xs text-foreground-400 mt-1">{bodyJa.length} / 8000</p>
              </div>

              <div>
                <label className="block font-heading font-semibold text-sm text-foreground-700 mb-3">
                  写真（任意、1枚ごとにひとこと添えられます）
                </label>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  multiple
                  id="travelogue-photos"
                  className="hidden"
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />

                <div className="space-y-3">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="flex items-start gap-3 bg-background-100 rounded-lg p-3"
                    >
                      <div className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-background-200">
                        <img
                          src={photo.previewUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {photo.status === 'uploading' && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <i className="ri-loader-4-line animate-spin text-white text-lg"></i>
                          </div>
                        )}
                        {photo.status === 'error' && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <i className="ri-error-warning-line text-red-300 text-lg"></i>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={photo.caption}
                          onChange={(e) => updateCaption(photo.id, e.target.value)}
                          placeholder="この写真にひとことキャプション（任意）"
                          className={`${inputClass} text-sm`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removePhoto(photo.id)}
                        className="text-foreground-300 hover:text-red-500 mt-2 transition-colors cursor-pointer flex-shrink-0"
                        aria-label="削除"
                      >
                        <i className="ri-close-line text-lg"></i>
                      </button>
                    </div>
                  ))}
                </div>

                {photos.length < MAX_PHOTOS && (
                  <label
                    htmlFor="travelogue-photos"
                    className="mt-3 w-full border-2 border-dashed border-background-300 hover:border-primary-300 text-foreground-500 hover:text-primary-600 font-semibold text-sm py-3 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <i className="ri-image-add-line"></i>
                    写真を追加（{photos.length}/{MAX_PHOTOS}）
                  </label>
                )}
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-3.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {submitting ? 'AIが解析中...' : '投稿してAIに整理してもらう'}
              </button>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
