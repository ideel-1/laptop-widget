/** one sticker on the lid's outer face */
export type LaptopSticker = {
  /** image source — a path into the consumer's static assets, a URL, or a data-URI */
  image: string;
  /** across the lid, in machine units (lid is 0.5 wide): −0.25 .. 0.25 */
  x: number;
  /** up the lid from the hinge, in machine units (lid is 0.345 long): 0 .. 0.345 */
  y: number;
  /** spin around the surface normal, radians */
  rotation?: number;
  /** sticker width in machine units; default 0.06 (~36mm real) */
  scale?: number;
};

/** everything the editor exports and the component consumes */
export type LaptopConfig = {
  /**
   * base aluminum color — every alu shade (lid, deck, divot, trackpad seam)
   * derives from it, so pink or black keeps the shading relationships.
   * Default "#c8ccd2" (silver).
   */
  color?: string;
  stickers?: LaptopSticker[];
  /**
   * page shown on the screen: a URL, "self" (the page embedding the widget),
   * or null for the animated wallpaper. Default "self".
   */
  screenUrl?: string | null;
  /** browser-style URL bar drawn inside the screen (only at depth 0). Default true */
  urlBar?: boolean;
};
