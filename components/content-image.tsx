import Image from "next/image";
export function ContentImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`content-image ${className}`}>
      <Image src={src} alt={alt} fill sizes="(max-width: 720px) 100vw, 50vw" />
    </div>
  );
}
