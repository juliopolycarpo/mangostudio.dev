import { getImage } from 'astro:assets';

import { siteAssets } from '@/data/assets';

export interface LogoImage {
  src: string;
  srcset?: string;
}

/**
 * Logo renditions shared by the header, footer, and demo so the build emits one
 * file per rendered size instead of one per call site.
 *
 * - `brand`: 28 px source with a 56 px 2x candidate. The header renders it at 28 CSS px and
 *   the footer at 26 CSS px, so both resolve to the same emitted files.
 * - `avatar`: the 40 px rendition the demo already emits, reused for the 20 CSS px chat avatar.
 *
 * @example
 * const { brand } = await getLogoImages();
 * // <img src={brand.src} srcset={brand.srcset} width="28" height="28" alt="" />
 */
export async function getLogoImages(): Promise<{ brand: LogoImage; avatar: LogoImage }> {
  const brand = await getImage({
    src: siteAssets.icon192,
    width: 28,
    height: 28,
    densities: [1, 2],
  });
  const avatar = await getImage({ src: siteAssets.icon192, width: 40, height: 40 });

  return {
    brand: { src: brand.src, srcset: brand.srcSet.attribute },
    avatar: { src: avatar.src },
  };
}
