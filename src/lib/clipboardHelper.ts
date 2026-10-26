/**
 * Helper utility for extracting and uploading images from clipboard across all browsers and OS
 * Supports:
 * - Direct files copied from Windows Explorer / macOS Finder (Ctrl+C file, then Ctrl+V)
 * - Screenshots from Snipping Tool / print screen (Win+Shift+S)
 * - Copied web images (right click -> Copy Image)
 * - Base64 inline images copied from rich text editors
 */
export async function extractImageFromClipboard(
  event: ClipboardEvent | React.ClipboardEvent
): Promise<File | null> {
  const clipboardData = (event as any).clipboardData || (window as any).clipboardData;
  if (!clipboardData) return null;

  // 1. Direct files in clipboard (FileList)
  const files: FileList | undefined = clipboardData.files;
  if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (
        file.type.startsWith('image/') ||
        /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name)
      ) {
        return file;
      }
    }
  }

  // 2. DataTransferItemList (Items in clipboard)
  const items: DataTransferItemList | undefined = clipboardData.items;
  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (
          file &&
          (file.type.startsWith('image/') ||
            /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name))
        ) {
          return file;
        }
      }
    }
  }

  // 3. Fallback: Base64 data image from HTML payload
  const htmlData = clipboardData.getData('text/html');
  if (htmlData && htmlData.includes('src="data:image/')) {
    const match = htmlData.match(/src="(data:image\/([a-zA-Z]+);base64,[^"]+)"/);
    if (match) {
      try {
        const dataUri = match[1];
        const mimeType = `image/${match[2]}`;
        const res = await fetch(dataUri);
        const blob = await res.blob();
        return new File([blob], `pasted-${Date.now()}.${match[2]}`, { type: mimeType });
      } catch {
        // Continue
      }
    }
  }

  return null;
}

/**
 * Uploads an image file to /api/upload and returns the relative public URL
 */
export async function uploadChatImage(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch (err) {
    console.error('[ClipboardHelper] Upload failed:', err);
    return null;
  }
}
