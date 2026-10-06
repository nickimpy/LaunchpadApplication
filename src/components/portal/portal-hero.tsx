import Image from "next/image";
import { HERO_PHOTOS } from "@/utils/portal-hero";

/**
 * Banner across the top of the portal home page: student photos (see
 * `src/utils/portal-hero.ts`) with the welcome heading laid over a dark
 * gradient so the white text always clears contrast. With no photos it is a
 * solid brand-teal block, so the page works before any are added.
 */
export function PortalHero({ name }: { name: string }) {
  const photos = HERO_PHOTOS.slice(0, 3);
  return (
    <section
      aria-labelledby="portal-welcome"
      className="relative mb-6 flex min-h-48 items-end overflow-hidden rounded-lg bg-teal-dark sm:min-h-64"
    >
      {photos.length > 0 && (
        <div
          className={`absolute inset-0 grid ${
            photos.length === 1
              ? "grid-cols-1"
              : photos.length === 2
                ? "grid-cols-2"
                : "grid-cols-1 sm:grid-cols-3"
          }`}
        >
          {photos.map((photo, i) => (
            <div
              key={photo.src}
              // On phones only the first photo shows when there are three, so
              // the banner stays a sensible height instead of stacking.
              className={`relative ${i > 0 && photos.length === 3 ? "hidden sm:block" : ""}`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(min-width: 640px) 33vw, 100vw"
                className="object-cover"
                priority={i === 0}
              />
            </div>
          ))}
        </div>
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent"
      />
      <h1
        id="portal-welcome"
        className="relative px-6 pb-6 text-2xl font-bold text-white sm:text-3xl"
      >
        Welcome, {name}!
      </h1>
    </section>
  );
}
