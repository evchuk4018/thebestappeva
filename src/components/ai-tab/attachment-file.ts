function extensionForMimeType(mediaType: string) {
  switch (mediaType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.png';
  }
}

function buildPastedImageName(mediaType: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `pasted-image-${timestamp}${extensionForMimeType(mediaType)}`;
}

export function normalizeAttachmentFile(file: File) {
  if (file.name.trim()) {
    return file;
  }

  const mediaType = file.type || 'application/octet-stream';
  if (!mediaType.startsWith('image/')) {
    return file;
  }

  return new File([file], buildPastedImageName(mediaType), { type: mediaType, lastModified: file.lastModified });
}
