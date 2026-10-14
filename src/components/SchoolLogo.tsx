import { useMemo } from "react";

const LOGO_PATH = "/school-logo.png";

export function SchoolLogo({
  alt = "ตราโรงเรียนเทพศิรินทร์ นนทบุรี",
  className,
  state = "app",
}: {
  alt?: string;
  className?: string;
  state?: string;
}) {
  const src = useMemo(
    () => `${LOGO_PATH}?v=2&state=${encodeURIComponent(state)}`,
    [state],
  );

  return (
    <img
      key={src}
      className={className}
      src={src}
      alt={alt}
      decoding="async"
      fetchPriority="high"
    />
  );
}
