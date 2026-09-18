// scripts/migrate-static-images.ts
//
// 【背景】
// ホームページ・About・記事など、コード内に直接readdy.aiの画像URLが
// ハードコードされている箇所（Spotデータのように動的にKVへ保存されて
// いるものではなく、ソースコードのリテラル文字列）がある。
// ReadyAIのアカウント削除前に、これらの画像もCloudflare R2へ移行する
// 必要があるため、一度だけ実行するスクリプトとしてここにまとめる。
//
// 【やること】
// 1. 下記 SOURCE_URLS の各URLを取得する（migrate-destination-images.ts
//    と同じ検証：https限定、readdy.aiのみ許可、DNS解決先がパブリックIPか
//    確認、10MB上限、実バイト列から画像形式を判定）
// 2. Cloudflare R2にアップロードする（オブジェクトキーはURLの
//    seq=パラメータを使うので、後から見て何の画像か分かりやすい）
// 3. 「元のURL → 新しいR2のURL」のマッピングをJSONで標準出力に出す
//
// 【このスクリプトが書き換えないもの】
// ソースコード（.ts/.tsx）内のURL文字列は書き換えない。このスクリプトは
// ダウンロード・アップロードだけを行い、出力されたマッピングを使って
// コード側の置き換えは別途（Claude側で）行う。
//
// 使い方:
//   npm run migrate-static-images -- --dry-run   … 検証のみ、R2には上げない
//   npm run migrate-static-images                … 実際にR2へアップロードする

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import dns from 'dns';

const SOURCE_URLS: string[] = [
  "https://readdy.ai/api/search-image?query=Abstract%20minimalist%20Japanese%20aesthetic%20composition%20with%20subtle%20ink%20wash%20texture%2C%20soft%20misty%20atmosphere%2C%20delicate%20negative%20space%2C%20warm%20off%20white%20and%20subtle%20charcoal%20tones%2C%20zen%20inspired%20editorial%20art%20photography%2C%20poetic%20quiet%20mood%20with%20natural%20light&width=600&height=800&seq=philosophy-visual-01&orientation=portrait",
  "https://readdy.ai/api/search-image?query=Close%20up%20of%20Japan%20Rail%20Pass%20ticket%20and%20passport%20on%20a%20wooden%20train%20station%20bench%2C%20soft%20morning%20light%20streaming%20through%20station%20windows%2C%20editorial%20travel%20photography%20with%20warm%20natural%20tones%2C%20clean%20minimalist%20composition&width=860&height=500&seq=article-jrpass-ticket-02&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Early%20morning%20in%20Kamakura%20Japan%2C%20empty%20temple%20pathway%20with%20stone%20steps%20and%20traditional%20wooden%20gate%2C%20soft%20dawn%20mist%20filtering%20through%20ancient%20cedar%20trees%2C%20peaceful%20solitary%20atmosphere%2C%20editorial%20travel%20photography%20with%20warm%20golden%20light&width=700&height=500&seq=local-morning-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Enoden%20train%20in%20Japan%20vintage%20green%20electric%20tram%20running%20along%20coastal%20track%20with%20ocean%20view%2C%20traditional%20Japanese%20neighborhood%20background%2C%20bright%20sunny%20day%2C%20travel%20photography%20style&width=600&height=400&seq=guide-transport-03&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Enoden%20vintage%20green%20train%20on%20coastal%20track%20in%20Kamakura%20Japan%2C%20bright%20sunny%20day%20with%20ocean%20view%2C%20traditional%20Japanese%20neighborhood%2C%20travel%20photography%20with%20clean%20composition&width=160&height=120&seq=article-sidebar-enoden-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Enoshima%20island%20Japan%20with%20coastal%20view%20dramatic%20sea%20cliffs%20and%20wooden%20bridge%2C%20blue%20ocean%20waves%2C%20clear%20sky%2C%20minimalist%20travel%20photography%20with%20warm%20afternoon%20light%2C%20clean%20composition&width=800&height=600&seq=enoshima-card-02&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Hidden%20Japanese%20bamboo%20grove%20path%20in%20Kamakura%20with%20sunlight%20filtering%20through%20tall%20green%20bamboo%20stalks%2C%20stone%20lantern%20along%20path%2C%20peaceful%20secluded%20atmosphere%2C%20vertical%20composition%20travel%20photography&width=600&height=400&seq=guide-hidden-04&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Japan%20Shinkansen%20bullet%20train%20speeding%20past%20Mount%20Fuji%20on%20a%20clear%20sunny%20day%2C%20dramatic%20perspective%20from%20trackside%2C%20blue%20sky%20with%20white%20clouds%2C%20iconic%20Japanese%20landscape%2C%20editorial%20travel%20photography%20high%20detail&width=1600&height=900&seq=article-hero-jrpass-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Japan%20Shinkansen%20bullet%20train%20speeding%20past%20Mount%20Fuji%20under%20a%20clear%20blue%20sky%2C%20Japan%20Rail%20Pass%20ticket%20held%20in%20foreground%20on%20a%20modern%20station%20platform%2C%20bright%20natural%20daylight%2C%20editorial%20travel%20photography%20with%20clean%20composition%20and%20warm%20tones&width=600&height=400&seq=guide-jrpass-05&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Japanese%20IC%20transport%20cards%20Suica%20and%20Pasmo%20on%20wooden%20table%2C%20close%20up%20product%20photography%2C%20minimalist%20composition%2C%20soft%20natural%20lighting%2C%20clean%20aesthetic&width=160&height=120&seq=article-sidebar-iccards-02&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Japanese%20railway%20map%20with%20colorful%20route%20lines%20on%20a%20wooden%20desk%2C%20travel%20planning%20concept%2C%20notebook%20and%20pen%20beside%20map%2C%20warm%20ambient%20lighting%2C%20editorial%20photography%20style&width=600&height=400&seq=article-related-passes-02&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Japanese%20seafood%20bowl%20with%20fresh%20shirasu%20whitebait%20on%20rice%20at%20seaside%20restaurant%2C%20wooden%20table%20with%20ocean%20background%2C%20natural%20lighting%2C%20food%20photography%20minimalist%20clean%20style&width=600&height=400&seq=guide-food-02&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Japanese%20wave%20pattern%20seigaiha%20style%20in%20light%20blue%20tones%2C%20repeating%20geometric%20ocean%20wave%20motif%2C%20subtle%20textured%20background%2C%20minimalist%20Japanese%20design%20aesthetic&width=1600&height=600&seq=budget-bg-pattern&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Kamakura%20Japan%20ancient%20temple%20with%20traditional%20wooden%20architecture%20surrounded%20by%20maple%20trees%2C%20stone%20pathway%2C%20soft%20morning%20light%2C%20minimalist%20composition%2C%20travel%20photography%20style%20with%20warm%20natural%20tones&width=800&height=600&seq=kamakura-card-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Kamakura%20Japan%20temple%20trail%20stone%20steps%20leading%20to%20traditional%20wooden%20temple%20gate%2C%20lush%20green%20bamboo%20forest%20surroundings%2C%20soft%20morning%20mist%2C%20minimalist%20travel%20photography%20warm%20natural%20light&width=600&height=400&seq=guide-temple-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Kyoto%20Japan%20traditional%20temple%20with%20vermillion%20torii%20gates%20and%20stone%20path%20surrounded%20by%20maple%20trees%20in%20warm%20afternoon%20light%2C%20ancient%20wooden%20architecture%2C%20minimalist%20travel%20photography%20with%20rich%20warm%20tones%20and%20clean%20composition&width=800&height=500&seq=region-kansai-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Mount%20Fuji%20and%20the%20Japanese%20Alps%20with%20lake%20reflection%20and%20forested%20foothills%20under%20clear%20blue%20sky%2C%20autumn%20colors%20beginning%20to%20show%2C%20minimalist%20travel%20photography%20with%20soft%20natural%20light%20and%20serene%20composition&width=800&height=500&seq=region-chubu-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Okinawa%20Japan%20tropical%20beach%20with%20crystal%20clear%20turquoise%20water%20white%20sand%20and%20lush%20green%20vegetation%20along%20the%20coastline%2C%20palm%20trees%20swaying%20in%20gentle%20breeze%2C%20minimalist%20travel%20photography%20with%20bright%20natural%20light%20and%20vibrant%20yet%20soft%20color%20palette&width=800&height=500&seq=region-kyushu-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Professional%20Japanese%20female%20writer%20portrait%20in%20early%2030s%2C%20friendly%20smile%2C%20editorial%20photography%2C%20warm%20natural%20light%2C%20clean%20aesthetic&width=64&height=64&seq=admin-avatar-hana-02&orientation=square",
  "https://readdy.ai/api/search-image?query=Professional%20Japanese%20male%20travel%20writer%20portrait%20in%20his%20late%2030s%2C%20warm%20friendly%20expression%2C%20editorial%20portrait%20style%20with%20soft%20natural%20lighting%2C%20blurred%20urban%20Tokyo%20background%2C%20clean%20modern%20aesthetic&width=128&height=128&seq=author-kenji-01&orientation=square",
  "https://readdy.ai/api/search-image?query=Professional%20Japanese%20male%20travel%20writer%20portrait%20in%20his%20late%2030s%2C%20warm%20friendly%20expression%2C%20editorial%20portrait%20style%20with%20soft%20natural%20lighting%2C%20blurred%20urban%20Tokyo%20background%2C%20clean%20modern%20aesthetic&width=128&height=128&seq=author-kenji-box-01&orientation=square",
  "https://readdy.ai/api/search-image?query=Professional%20Japanese%20male%20writer%20portrait%20in%20late%2020s%2C%20casual%20professional%20look%2C%20editorial%20style%2C%20soft%20studio%20lighting%2C%20neutral%20background&width=64&height=64&seq=admin-avatar-yuki-03&orientation=square",
  "https://readdy.ai/api/search-image?query=Professional%20Japanese%20male%20writer%20portrait%20in%20late%2030s%2C%20warm%20expression%2C%20editorial%20style%2C%20soft%20lighting%2C%20blurred%20Tokyo%20background&width=64&height=64&seq=admin-avatar-kenji-01&orientation=square",
  "https://readdy.ai/api/search-image?query=Quiet%20and%20clean%20Japanese%20train%20interior%20with%20polite%20passengers%2C%20orderly%20atmosphere%2C%20soft%20natural%20lighting%20through%20windows%2C%20documentary%20style%20photography%2C%20authentic%20travel%20moment&width=160&height=120&seq=article-sidebar-etiquette-03&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Serene%20Japanese%20landscape%20with%20a%20red%20torii%20gate%20and%20Mount%20Fuji%20at%20golden%20hour%2C%20soft%20gradient%20sky%20in%20warm%20amber%20and%20deep%20indigo%2C%20delicate%20cherry%20blossom%20petals%20floating%20in%20the%20air%2C%20misty%20atmosphere%2C%20artistic%20digital%20illustration%2C%20elegant%20minimal%20composition%2C%20high%20detail%2C%20cinematic%20lighting&width=1600&height=900&seq=creators-hero-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Seto%20Inland%20Sea%20coastline%20with%20small%20islands%20scattered%20across%20calm%20blue%20water%20and%20traditional%20fishing%20boats%20near%20shore%2C%20soft%20afternoon%20light%2C%20minimalist%20travel%20photography%20with%20muted%20blue%20and%20warm%20neutral%20color%20palette&width=800&height=500&seq=region-chugoku-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Shikoku%20Japan%20rural%20coastal%20village%20with%20small%20harbor%20traditional%20wooden%20houses%20and%20green%20terraced%20hills%20meeting%20the%20sea%2C%20soft%20morning%20mist%2C%20minimalist%20travel%20photography%20with%20natural%20earth%20tones%20and%20peaceful%20composition&width=800&height=500&seq=region-shikoku-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Shinkansen%20bullet%20train%20interior%20with%20comfortable%20seats%20and%20large%20window%20showing%20Japanese%20countryside%20scenery%2C%20clean%20modern%20design%2C%20natural%20daylight%2C%20travel%20lifestyle%20photography&width=600&height=400&seq=article-related-shinkansen-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Shonan%20coast%20Japan%20sandy%20beach%20with%20surfboards%20and%20palm%20trees%2C%20ocean%20view%20with%20gentle%20waves%2C%20warm%20golden%20sunset%20light%2C%20minimalist%20beach%20town%20vibe%2C%20travel%20lifestyle%20photography&width=800&height=600&seq=shonan-card-03&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Shonan%20coast%20Japan%20sunset%20view%20from%20quiet%20rocky%20shoreline%2C%20silhouette%20of%20distant%20Enoshima%20island%20under%20dramatic%20pink%20and%20orange%20twilight%20sky%2C%20calm%20ocean%20waves%2C%20peaceful%20solitary%20moment%2C%20atmospheric%20travel%20photography&width=700&height=500&seq=local-sunset-03&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Small%20traditional%20Japanese%20soba%20noodle%20restaurant%20interior%20with%20wooden%20counter%20and%20only%20a%20few%20seats%2C%20artisan%20chef%20preparing%20handmade%20soba%20noodles%2C%20warm%20lantern%20lighting%2C%20intimate%20authentic%20atmosphere%2C%20documentary%20food%20photography&width=700&height=500&seq=local-soba-04&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Smartphone%20displaying%20Japanese%20train%20route%20planning%20app%20on%20screen%2C%20held%20by%20traveler%20on%20a%20train%20platform%2C%20blurred%20Shinkansen%20in%20background%2C%20modern%20travel%20technology%2C%20natural%20daylight&width=600&height=400&seq=article-related-apps-03&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Snow-covered%20Hokkaido%20landscape%20with%20rolling%20hills%20and%20farm%20fields%20under%20clear%20winter%20sky%2C%20minimalist%20travel%20photography%20with%20soft%20natural%20light%2C%20muted%20cool%20color%20palette%2C%20clean%20composition%20and%20wide%20open%20space&width=800&height=500&seq=region-hokkaido-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Tohoku%20Japan%20mountain%20valley%20with%20rice%20terraces%20and%20misty%20green%20forests%20in%20early%20morning%20light%2C%20rural%20scenery%20with%20traditional%20farmhouses%2C%20minimalist%20travel%20photography%20with%20warm%20natural%20tones%20and%20clean%20composition&width=800&height=500&seq=region-tohoku-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Tokyo%20Japan%20cityscape%20blending%20modern%20skyscrapers%20with%20traditional%20temple%20rooftops%20and%20cherry%20blossom%20trees%20along%20a%20river%2C%20soft%20golden%20hour%20light%2C%20minimalist%20travel%20photography%20with%20warm%20neutral%20color%20palette%20and%20clean%20composition&width=800&height=500&seq=region-kanto-01&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Traditional%20Japanese%20kissaten%20coffee%20shop%20interior%20with%20Showa%20era%20retro%20styling%2C%20wooden%20counter%20and%20leather%20stools%2C%20hand%20drip%20coffee%20setup%2C%20warm%20ambient%20lighting%2C%20cozy%20intimate%20atmosphere%2C%20documentary%20style%20photography&width=700&height=500&seq=local-cafe-02&orientation=landscape",
  "https://readdy.ai/api/search-image?query=Traditional%20Japanese%20pottery%20studio%20interior%20with%20craftsman%20hands%20shaping%20clay%20on%20wooden%20wheel%2C%20warm%20ambient%20light%20from%20paper%20lantern%2C%20shelves%20of%20handmade%20ceramics%20in%20background%2C%20documentary%20style%20photography%20with%20intimate%20atmosphere%2C%20soft%20natural%20tones&width=600&height=800&seq=about-philosophy-visual&orientation=portrait",
  "https://readdy.ai/api/search-image?query=View%20from%20inside%20vintage%20Japanese%20Enoden%20green%20electric%20train%20window%20showing%20coastal%20ocean%20scenery%2C%20traditional%20train%20interior%20with%20wooden%20elements%2C%20warm%20afternoon%20sunlight%20streaming%20through%2C%20nostalgic%20travel%20moment%20photography&width=700&height=500&seq=local-enoden-05&orientation=landscape",
];

const ALLOWED_HOSTS = ['readdy.ai'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

function getExtensionFromContentType(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('avif')) return 'avif';
  return 'jpg';
}

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => h === allowed || h.endsWith(`.${allowed}`));
}

function isPublicIPv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const parts = m.slice(1, 5).map(Number);
  if (parts.some((n) => n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return false;
  if (a === 127) return false;
  if (a === 0) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicIPv6(ip: string): boolean {
  const h = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '::1') return false;
  if (/^fe80:/.test(h)) return false;
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return false;
  const mapped = h.match(/(?:^::ffff:|^::)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPublicIPv4(mapped[1]);
  return true;
}

async function resolvesToPublicIpsOnly(hostname: string): Promise<boolean> {
  try {
    const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return false;
    return records.every((r) => (r.family === 4 ? isPublicIPv4(r.address) : isPublicIPv6(r.address)));
  } catch {
    return false;
  }
}

async function validateImageUrl(raw: string): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'Only https URLs are allowed' };
  if (!isAllowedHost(url.hostname)) return { ok: false, error: 'This host is not on the allowlist' };
  if (!(await resolvesToPublicIpsOnly(url.hostname))) {
    return { ok: false, error: 'This host does not resolve to a public address' };
  }
  return { ok: true, url };
}

function detectImageFormat(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'image/avif';
  }
  return null;
}

async function readBodyWithLimit(res: Response, maxBytes: number): Promise<Buffer | { error: string }> {
  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) return { error: `Image too large (${buf.byteLength} bytes)` };
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          return { error: `Image too large (exceeded ${maxBytes} bytes while streaming)` };
        }
        chunks.push(value);
      }
    }
  } catch {
    return { error: 'Failed while reading response body' };
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

async function fetchImageSafely(
  rawUrl: string
): Promise<{ buffer: Buffer; contentType: string } | { error: string }> {
  const checked = await validateImageUrl(rawUrl);
  if (checked.ok === false) return { error: checked.error };

  let imgRes: Response;
  try {
    imgRes = await fetch(checked.url.toString(), {
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error('[migrate-static-images] fetch failed:', err);
    return { error: 'Failed to reach the source host' };
  }

  if (imgRes.status >= 300 && imgRes.status < 400) return { error: 'Redirects are not followed' };
  if (!imgRes.ok) return { error: `Upstream returned status ${imgRes.status}` };

  const declaredType = (imgRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(declaredType)) return { error: 'Unsupported content-type' };

  const declaredLength = Number(imgRes.headers.get('content-length') || 0);
  if (declaredLength && declaredLength > MAX_IMAGE_BYTES) {
    return { error: 'Image too large (declared content-length)' };
  }

  const bodyResult = await readBodyWithLimit(imgRes, MAX_IMAGE_BYTES);
  if ('error' in bodyResult) return bodyResult;

  const actualType = detectImageFormat(bodyResult);
  if (!actualType) return { error: 'File does not look like a supported image format' };

  return { buffer: bodyResult, contentType: actualType };
}

function seqFromUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const seq = u.searchParams.get('seq');
    if (seq) return seq.replace(/[^a-zA-Z0-9_-]/g, '-');
  } catch {
    /* フォールバックへ */
  }
  return crypto.randomUUID();
}

function parseArgs() {
  const argv = process.argv.slice(2);
  return { dryRun: argv.includes('--dry-run') };
}

async function main() {
  const args = parseArgs();

  console.log('='.repeat(60));
  console.log('コード内にハードコードされたreaddy.ai画像のR2移行');
  if (args.dryRun) console.log('※ dry-run: 検証のみで、R2へのアップロードは行いません');
  console.log(`対象: ${SOURCE_URLS.length}件`);
  console.log('='.repeat(60));

  let s3: S3Client | null = null;
  let publicUrlBase = '';

  if (!args.dryRun) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      console.error('R2の環境変数（R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME / R2_PUBLIC_URL）が設定されていません');
      process.exit(1);
    }
    s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    publicUrlBase = publicUrl.replace(/\/$/, '');
  }

  const mapping: Record<string, string> = {};
  const errors: { url: string; error: string }[] = [];
  let done = 0;

  for (const url of SOURCE_URLS) {
    done += 1;
    const seq = seqFromUrl(url);
    process.stdout.write(`\r  処理中: ${done}/${SOURCE_URLS.length} (${seq})`);

    const fetched = await fetchImageSafely(url);
    if ('error' in fetched) {
      errors.push({ url, error: fetched.error });
      continue;
    }

    if (args.dryRun) {
      mapping[url] = `[dry-run: ${fetched.contentType}, ${fetched.buffer.byteLength} bytes]`;
      continue;
    }

    const objectKey = `static/${seq}.${getExtensionFromContentType(fetched.contentType)}`;
    try {
      await s3!.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: objectKey,
          Body: fetched.buffer,
          ContentType: fetched.contentType,
        })
      );
      mapping[url] = `${publicUrlBase}/${objectKey}`;
    } catch (err) {
      errors.push({ url, error: `R2 upload failed: ${String(err)}` });
    }
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log(`成功: ${Object.keys(mapping).length}件 / 失敗: ${errors.length}件`);
  console.log('='.repeat(60));

  if (errors.length > 0) {
    console.log('\n--- 失敗した画像 ---');
    for (const e of errors) console.log(`${e.url}\n  → ${e.error}`);
  }

  console.log('\n--- マッピング（この出力全体をコピーして共有してください） ---');
  console.log(JSON.stringify(mapping, null, 2));
}

main().catch((e) => {
  console.error('致命的エラー:', e);
  process.exit(1);
});
