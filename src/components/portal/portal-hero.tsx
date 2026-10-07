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

/** Portal home: the banner, then the welcome heading. */
export function PortalHero({ name }: { name: string }) {
  return (
    <section aria-labelledby="portal-welcome" className="mb-6">
      <BannerPhoto priority />
      <h1 id="portal-welcome" className="mt-6 text-2xl font-bold sm:text-3xl">
        Welcome, {name}!
      </h1>
    </section>
  );
}
