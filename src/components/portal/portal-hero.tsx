import Image from "next/image";
import { BANNER } from "@/utils/portal-hero";

/**
 * The Launchpad banner photo, full width at its natural 4:1 shape. Text is
 * kept OFF the photo — over a crowd shot it can't hold contrast — so headings
 * go underneath. The photo's white clouds blend into the white page below.
 */
export function BannerPhoto({ priority = false }: { priority?: boolean }) {
  return (
    <Image
      src={BANNER.src}
      alt={BANNER.alt}
      width={BANNER.width}
      height={BANNER.height}
      sizes="(min-width: 1024px) 1024px, 100vw"
      priority={priority}
      className="h-auto w-full rounded-lg"
    />
  );
}

/**
 * Portal home welcome. The photo itself is the BannerStrip the portal layout
 * puts above every page, so it isn't repeated here.
 */
export function PortalHero({ name }: { name: string }) {
  return (
    <h1 id="portal-welcome" className="mb-3 text-2xl font-bold sm:text-3xl">
      Welcome, {name}!
    </h1>
  );
}

/**
 * The banner at the top of every application page (portal + login/signup).
 * Never cropped: it renders at the photo's own 4:1 shape and takes the width
 * of whatever column it sits in. (A full-width strip had to crop a 4:1 photo
 * to ~15:1 on desktop, which cut off the students' heads.) Decorative here
 * (alt=""): the same photo is described in full on the landing page, and
 * repeating that on every page would be noise for screen readers.
 */
export function BannerStrip({ className = "" }: { className?: string }) {
  return (
    <Image
      src={BANNER.src}
      alt=""
      aria-hidden="true"
      width={BANNER.width}
      height={BANNER.height}
      sizes="(min-width: 768px) 672px, 100vw"
      priority
      className={`h-auto w-full rounded-lg ${className}`}
    />
  );
}
