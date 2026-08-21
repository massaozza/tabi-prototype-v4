// /api/_store.ts
// 複数ユーザーが同時に書き込むデータ（Trip, Experience等）のための共通KVヘルパー。
//
// localsPlaces / articles などの「編集部コンテンツ」は、配列を丸ごと1つのキーに
// 保存し、保存のたびに丸ごと上書きする方式（api/content.ts）を使っている。
// これは編集者が単独で操作する前提なら問題ないが、不特定多数のユーザーが
// 同時に投稿するデータ（Trip・Experience）には向かない
// （2人が同時に保存すると、後から保存した方が先の投稿を消してしまうため）。
//
// このモジュールは、代わりに「1レコード＝1キー」で保存し、一覧管理には
// RedisのSet型（sadd/smembers/srem）を使う。Set型への追加・削除は
// Redis内部でアトミックに処理されるため、同時書き込みが発生しても
// データが失われることがない。
//
// キー設計：
// - {collection}:{id}          → レコード本体（JSON）
// - {collection}:all           → そのコレクション全体のID一覧（Set）
// - user:{uid}:{collection}    → 特定ユーザーが持つID一覧（Set）

import { kv } from '@vercel/kv';

function recordKey(collection: string, id: string): string {
  return `${collection}:${id}`;
}

function collectionIndexKey(collection: string): string {
  return `${collection}:all`;
}

function userIndexKey(collection: string, uid: string): string {
  return `user:${uid}:${collection}`;
}

/**
 * 新規レコードを作成する。
 * uid を渡すと、そのユーザー専用の索引にも追加される。
 */
export async function createRecord<T>(
  collection: string,
  id: string,
  data: T,
  uid?: string
): Promise<void> {
  await kv.set(recordKey(collection, id), data);
  await kv.sadd(collectionIndexKey(collection), id);
  if (uid) {
    await kv.sadd(userIndexKey(collection, uid), id);
  }
}

/** 1件のレコードを取得する。存在しなければ null。 */
export async function getRecord<T>(
  collection: string,
  id: string
): Promise<T | null> {
  const value = await kv.get<T>(recordKey(collection, id));
  return value ?? null;
}

/**
 * 既存レコードの中身を丸ごと差し替える。
 * 索引（Set）はidが変わらない限り触らない。
 */
export async function updateRecord<T>(
  collection: string,
  id: string,
  data: T
): Promise<void> {
  await kv.set(recordKey(collection, id), data);
}

/** レコードを削除し、索引からも取り除く。 */
export async function deleteRecord(
  collection: string,
  id: string,
  uid?: string
): Promise<void> {
  await kv.del(recordKey(collection, id));
  await kv.srem(collectionIndexKey(collection), id);
  if (uid) {
    await kv.srem(userIndexKey(collection, uid), id);
  }
}

/** コレクション内の全レコードを取得する（AIの参照・一覧表示用）。 */
export async function listRecords<T>(collection: string): Promise<T[]> {
  const ids = await kv.smembers(collectionIndexKey(collection));
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<T[]>(...ids.map((id) => recordKey(collection, id)));
  return (values || []).filter((v): v is T => v !== null && v !== undefined);
}

/** 特定ユーザーが持つレコードだけを取得する（マイページ用）。 */
export async function listUserRecords<T>(
  collection: string,
  uid: string
): Promise<T[]> {
  const ids = await kv.smembers(userIndexKey(collection, uid));
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<T[]>(...ids.map((id) => recordKey(collection, id)));
  return (values || []).filter((v): v is T => v !== null && v !== undefined);
}
