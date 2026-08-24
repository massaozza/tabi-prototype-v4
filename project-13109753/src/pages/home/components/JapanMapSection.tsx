import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PREFECTURE_REGIONS } from '@/mocks/prefectureData';

// 各地域の見た目上の配置（実際の海岸線ではなく、位置関係を大まかに再現した
// 模式図。北海道が北、沖縄が南、というような相対位置は正しく保っている）。
interface MapShape {
  slug: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
}

const MAP_SHAPES: MapShape[] = [
  { slug: 'hokkaido', x: 205, y: 15, width: 85, height: 68, rotate: 18 },
  { slug: 'tohoku', x: 180, y: 100, width: 62, height: 92, rotate: 8 },
  { slug: 'kanto', x: 197, y: 202, width: 52, height: 46, rotate: 2 },
  { slug: 'chubu', x: 128, y: 188, width: 74, height: 68, rotate: -6 },
  { slug: 'kansai', x: 108, y: 262, width: 58, height: 52, rotate: -10 },
  { slug: 'chugoku', x: 48, y: 296, width: 74, height: 46, rotate: -16 },
  { slug: 'shikoku', x: 95, y: 348, width: 52, height: 36, rotate: -8 },
  { slug: 'kyushu-okinawa', x: 20, y: 353, width: 74, height: 82, rotate: -20 },
  // 沖縄（同じリージョンだが、実際に離れた諸島であることが伝わるよう別図形にする）
  { slug: 'kyushu-okinawa', x: 24, y: 470, width: 42, height: 20, rotate: -4 },
];

export default function JapanMapSection() {
  const navigate = useNavigate();
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  const hoveredRegion = hoveredSlug
    ? PREFECTURE_REGIONS.find((r) => r.slug === hoveredSlug)
    : null;

  return (
    <section className="py-16 md:py-24 px-6 md:px-10 lg:px-20 bg-background-100">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10 text-center">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-600 mb-3">
            All 47 Prefectures
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground-900 leading-tight mb-3">
            Explore Japan <span className="text-primary-500">Region by Region</span>
          </h2>
          <p className="text-foreground-500 text-base max-w-xl mx-auto">
            Select a region on the map to see its prefectures and destinations.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* 模式地図 */}
          <div className="w-full max-w-xs mx-auto md:mx-0 flex-shrink-0">
            <svg viewBox="0 0 320 520" className="w-full h-auto">
              {MAP_SHAPES.map((shape, idx) => {
                const isHovered = hoveredSlug === shape.slug;
                const cx = shape.x + shape.width / 2;
                const cy = shape.y + shape.height / 2;
                return (
                  <rect
                    key={`${shape.slug}-${idx}`}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    rx={14}
                    transform={`rotate(${shape.rotate} ${cx} ${cy})`}
                    fill={isHovered ? '#f97316' : '#86a67c'}
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="cursor-pointer transition-colors duration-150"
                    onMouseEnter={() => setHoveredSlug(shape.slug)}
                    onMouseLeave={() => setHoveredSlug(null)}
                    onClick={() => navigate(`/regions/${shape.slug}`)}
                  />
                );
              })}
            </svg>
            <p className="text-center text-foreground-400 text-xs mt-3">
              (Simplified map — not to scale)
            </p>
          </div>

          {/* 選択中の地域カード */}
          <div className="flex-1 w-full bg-background-50 border border-background-200 rounded-xl p-6 md:p-8 min-h-[180px] flex flex-col justify-center">
            {hoveredRegion ? (
              <>
                <span className="inline-block text-xs font-semibold tracking-widest uppercase text-accent-600 mb-2">
                  Explore
                </span>
                <h3 className="font-heading font-bold text-2xl text-foreground-900 mb-2">
                  {hoveredRegion.region}
                </h3>
                <p className="text-foreground-600 text-sm leading-relaxed mb-4">
                  {hoveredRegion.description}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/regions/${hoveredRegion.slug}`)}
                  className="inline-flex items-center gap-2 self-start text-primary-500 font-semibold text-sm hover:gap-3 transition-all duration-200 cursor-pointer whitespace-nowrap"
                >
                  View {hoveredRegion.region}
                  <i className="ri-arrow-right-line"></i>
                </button>
              </>
            ) : (
              <div className="text-center">
                <i className="ri-map-2-line text-3xl text-foreground-300 block mb-3"></i>
                <p className="text-foreground-500 text-sm">
                  Hover or tap a region on the map to preview it.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
