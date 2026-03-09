type StoredValue = { id: string } & Record<string, unknown>;

type RequestHandlers<T> = {
  onsuccess: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  result?: T;
  error: Error | null;
};

function emitRequestResult<T>(request: RequestHandlers<T>, resolveValue: () => T): void {
  queueMicrotask(() => {
    try {
      request.result = resolveValue();
      request.onsuccess?.({ target: request } as unknown as Event);
    } catch (error) {
      request.error = error instanceof Error ? error : new Error(String(error));
      request.onerror?.({ target: request } as unknown as Event);
    }
  });
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createIndexedDbMock(): IDBFactory {
  const databases = new Map<string, Map<string, Map<string, StoredValue>>>();

  return {
    open(name: string) {
      const request = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest & RequestHandlers<IDBDatabase>;

      queueMicrotask(() => {
        let stores = databases.get(name);
        const needsUpgrade = !stores;
        if (!stores) {
          stores = new Map();
          databases.set(name, stores);
        }

        const db = {
          objectStoreNames: {
            contains(storeName: string) {
              return stores.has(storeName);
            },
          },
          createObjectStore(storeName: string) {
            if (!stores.has(storeName)) {
              stores.set(storeName, new Map());
            }
          },
          transaction(storeName: string) {
            const storeRecords = stores.get(storeName);
            if (!storeRecords) {
              throw new Error(`Store ${storeName} not found`);
            }

            let completed = false;
            let oncomplete: ((event: Event) => void) | null = null;
            const transaction = {
              error: null,
              onerror: null,
              onabort: null,
              objectStore() {
                const buildRequest = <T>(resolver: () => T) => {
                  const txRequest = {
                    result: undefined,
                    error: null,
                    onsuccess: null,
                    onerror: null,
                  } as unknown as IDBRequest<T> & RequestHandlers<T>;
                  emitRequestResult(txRequest, () => {
                    const result = resolver();
                    completed = true;
                    if (oncomplete) {
                      queueMicrotask(() =>
                        oncomplete?.({ target: transaction } as unknown as Event),
                      );
                    }
                    return result;
                  });
                  return txRequest;
                };

                return {
                  getAll() {
                    return buildRequest(() => Array.from(storeRecords.values()).map(cloneValue));
                  },
                  get(key: string) {
                    return buildRequest(() => {
                      const value = storeRecords.get(key);
                      return value ? cloneValue(value) : undefined;
                    });
                  },
                  put(value: StoredValue) {
                    return buildRequest(() => {
                      storeRecords.set(value.id, cloneValue(value));
                      return value.id;
                    });
                  },
                  delete(key: string) {
                    return buildRequest(() => {
                      storeRecords.delete(key);
                      return undefined;
                    });
                  },
                  clear() {
                    return buildRequest(() => {
                      storeRecords.clear();
                      return undefined;
                    });
                  },
                } as unknown as IDBObjectStore;
              },
            } as unknown as IDBTransaction;

            Object.defineProperty(transaction, 'oncomplete', {
              get() {
                return oncomplete;
              },
              set(handler: ((event: Event) => void) | null) {
                oncomplete = handler;
                if (completed && oncomplete) {
                  queueMicrotask(() => oncomplete?.({ target: transaction } as unknown as Event));
                }
              },
            });

            return transaction;
          },
        } as unknown as IDBDatabase;

        request.result = db;
        if (needsUpgrade) {
          request.onupgradeneeded?.({ target: request } as unknown as IDBVersionChangeEvent);
        }
        queueMicrotask(() => request.onsuccess?.({ target: request } as unknown as Event));
      });

      return request;
    },
  } as unknown as IDBFactory;
}
