export interface WireframeShapeData {
  wireframeType?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  groupId?: string;
  groupRoot?: boolean;
  compositeType?: string;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function isWireframeGroupChild(data: WireframeShapeData): boolean {
  return !!data.groupId && !data.groupRoot;
}

export function scaleWireframeRect(
  rect: { x: number; y: number; w: number; h: number },
  from: BBox,
  to: BBox,
): { x: number; y: number; w: number; h: number } {
  if (from.width <= 0 || from.height <= 0) return rect;
  const relX = (rect.x - from.x) / from.width;
  const relY = (rect.y - from.y) / from.height;
  const relW = rect.w / from.width;
  const relH = rect.h / from.height;
  return {
    x: to.x + relX * to.width,
    y: to.y + relY * to.height,
    w: relW * to.width,
    h: relH * to.height,
  };
}

export const COMPOSITE_DISPLAY_NAMES: Record<string, string> = {
  offer_section: "Offer Section",
  slideshow: "Slideshow",
  auth_login: "Login Form",
  auth_signup: "Sign Up Form",
  profile_page: "Profile Page",
};
