interface SortableSessionLike {
  pinnedAt: string | null;
  createdAt: string;
}

export function compareSessionsByPinnedAndCreated<T extends SortableSessionLike>(
  left: T,
  right: T,
): number {
  const leftPinnedAt = left.pinnedAt ?? '';
  const rightPinnedAt = right.pinnedAt ?? '';

  if (leftPinnedAt !== rightPinnedAt) {
    return rightPinnedAt.localeCompare(leftPinnedAt);
  }

  return right.createdAt.localeCompare(left.createdAt);
}
