/**
 * @fileoverview imageStore — IndexedDB 图片存储（v3.0 TASK-056 T-561）
 *
 * 图片不进 localStorage（5MB 配额撑不住），
 * 统一存进 IndexedDB `salary_timer_images`（`imageId → Blob`）。
 *
 * 行为约定：
 * - 测试环境 / 隐私模式（无 `indexedDB`）→ 全部静默降级（返回 null / false / noop）
 * - 真实数据库打开失败也降级 —— 记账主流程不被图片 IO 阻塞
 * - 单例缓存 db handle；版本号 `1`
 */
const DB_NAME = 'salary_timer_images';
const DB_VERSION = 1;
const STORE_NAME = 'images';

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * 检查当前环境是否支持 IndexedDB（测试环境 / SSR 走 false）。
 */
export function isImageDBSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * 懒打开数据库（单例）。失败时返回 reject 但不抛出 —— 由调用方选择如何处理。
 */
function openImageDB(): Promise<IDBDatabase> {
  if (!isImageDBSupported()) return Promise.reject(new Error('IndexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('IndexedDB open failed'));
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error('IndexedDB open blocked'));
    };
  });
  return dbPromise;
}

/**
 * 写入图片。返回是否成功 —— 失败（环境不支持 / IO 错误）一律返回 false，不抛。
 */
export async function putImage(imageId: string, blob: Blob): Promise<boolean> {
  if (!isImageDBSupported()) return false;
  try {
    const db = await openImageDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, imageId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取图片。失败 / 不存在返回 null。
 */
export async function getImage(imageId: string): Promise<Blob | null> {
  if (!isImageDBSupported()) return null;
  try {
    const db = await openImageDB();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(imageId);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * 删除图片。不存在静默成功，失败静默吞掉。
 */
export async function deleteImage(imageId: string): Promise<void> {
  if (!isImageDBSupported()) return;
  try {
    const db = await openImageDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(imageId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // 静默
  }
}

/**
 * 检查图片是否存在。
 */
export async function hasImage(imageId: string): Promise<boolean> {
  if (!isImageDBSupported()) return false;
  try {
    const db = await openImageDB();
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getKey(imageId);
      req.onsuccess = () => resolve(req.result !== undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

/** 测试 / 重置：清空 db 句柄缓存（不删数据）。 */
export function _resetImageDBHandleForTests(): void {
  dbPromise = null;
}
