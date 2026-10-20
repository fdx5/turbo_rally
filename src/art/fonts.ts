/** Make sure the Google Fonts used by canvas decals are loaded before we rasterise them. */
export async function loadFonts() {
  if (!document.fonts) return;
  const specs = ['400 64px "Black Han Sans"', '700 64px "Jua"', '400 64px "Jua"', '400 64px "Do Hyeon"', '700 64px "Fredoka"', '600 64px "Fredoka"'];
  try {
    await Promise.race([Promise.all(specs.map((s) => document.fonts.load(s, '가나다 TURBO 119'))), new Promise((r) => setTimeout(r, 2500))]);
  } catch {
    /* offline: fall back to system fonts */
  }
}
