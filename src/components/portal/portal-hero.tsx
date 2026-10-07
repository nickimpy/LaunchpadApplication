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
 * A short, full-width crop of the banner for the top of every application
 * page (portal + login/signup). Cropped to a thin band centred on the
 * students' faces so it adds warmth without pushing the form down. Decorative
 * here (alt=""): the same photo is described in full on the landing page, and
 * repeating that description on every page would be noise for screen readers.
 */
export function BannerStrip() {
  return (
    <div className="relative h-24 w-full overflow-hidden sm:h-32" aria-hidden="true">
      <Image
        src={BANNER.src}
        alt=""
        fill
        sizes="100vw"
        priority
        // 62% down keeps faces and pennants in frame, not ceiling or clouds.
        className="object-cover object-[50%_62%]"
      />
    </div>
  );
}
