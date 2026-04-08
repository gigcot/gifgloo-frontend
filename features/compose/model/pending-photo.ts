let pendingPhoto: File | null = null;

export function setPendingPhoto(file: File) {
  pendingPhoto = file;
}

/** 꺼내면서 비움 (한 번만 소비) */
export function takePendingPhoto(): File | null {
  const f = pendingPhoto;
  pendingPhoto = null;
  return f;
}
