// No credentials are needed to render existing images, including after a provider switch.
export function cloudinaryName() {
  const name = process.env.CLOUDINARY_CLOUD_NAME || "";
  return /^[a-z0-9_-]+$/.test(name) ? name : "";
}

export function isCloudinaryImage(url: URL) {
  const name = cloudinaryName();
  return (
    !!name &&
    url.protocol === "https:" &&
    url.hostname === "res.cloudinary.com" &&
    !url.port &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    url.pathname.startsWith(`/${name}/image/upload/`) &&
    /\.(jpg|jpeg|png|webp|avif)$/i.test(url.pathname)
  );
}
