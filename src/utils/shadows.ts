export type SoftShadowOptions = {
  color?: string;
  opacity?: number;
  radius?: number;
  offsetY?: number;
  offsetX?: number;
  spread?: number;
};

const HEX = /^#([0-9a-f]{3,8})$/i;

function toRgba(color: string, opacity: number): string {
  const match = HEX.exec(color.trim());
  if (!match) {
    const open = color.indexOf('(');
    return open > -1 ? color.slice(0, open) + color.slice(open).replace(/,[^,]*\)$/, `, ${opacity})`) : color;
  }
  let hex = match[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length === 4) hex = hex.slice(0, 3).split('').map((c) => c + c).join('');
  const int = parseInt(hex.slice(0, 6), 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Cross-platform soft shadow. Android's `elevation` paints a hard grey rim around
 * rounded views (visible as a faint 1px border), so we emit a blurred `boxShadow`
 * instead, which New Architecture renders on both platforms without the rim.
 */
export function softShadow({
  color = '#101828',
  opacity = 0.06,
  radius = 8,
  offsetY = 2,
  offsetX = 0,
  spread,
}: SoftShadowOptions = {}) {
  const spreadPart = spread === undefined ? '' : `${spread}px `;
  return {
    boxShadow: `${offsetX}px ${offsetY}px ${radius}px ${spreadPart}${toRgba(color, opacity)}`,
  };
}
