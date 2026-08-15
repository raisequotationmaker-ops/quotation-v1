/** Resize/compress product images before upload (max width ~1200px). */
export async function resizeImageFile(
  file: File,
  maxWidth = 1200,
  quality = 0.85,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width <= maxWidth) {
      return file;
    }
    const scale = maxWidth / bitmap.width;
    const width = maxWidth;
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "product";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
