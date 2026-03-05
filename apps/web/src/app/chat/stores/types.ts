export type Updater<T> = T | ((previous: T) => T);
