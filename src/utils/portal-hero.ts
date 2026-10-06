// Photos for the banner across the top of the student portal home page.
//
// To add one: drop the image into `public/photos/` and add an entry below with
// a short, factual description for screen readers (WCAG — never leave `alt`
// empty for a photo that carries meaning, and describe what's in it rather
// than the file name). Landscape, roughly 1200px wide or larger. Up to 3 are
// shown side by side; with none, the banner falls back to a plain brand-teal
// block so nothing looks broken.
//
// Only use photos students (and their families, if under 18) have agreed to
// have published.

export type HeroPhoto = { src: string; alt: string };

export const HERO_PHOTOS: HeroPhoto[] = [
  // { src: "/photos/hero-1.jpg", alt: "Launchpad students working together at laptops" },
];
