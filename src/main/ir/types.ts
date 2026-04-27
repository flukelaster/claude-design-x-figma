export type LayoutMode = 'flex' | 'block' | 'inline' | 'grid' | 'none';
export type FlexDir = 'row' | 'column';
export type AxisAlign = 'start' | 'center' | 'end' | 'space-between' | 'baseline' | 'stretch';
export type SizingMode = 'fixed' | 'hug' | 'fill';

export type Padding = { t: number; r: number; b: number; l: number };

export type ShadowSpec = {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string; // hex w/ alpha
};

export type Corners = { tl: number; tr: number; bl: number; br: number };
export type BorderSides = { t: number; r: number; b: number; l: number };
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'none';
export type ObjectFit = 'fill' | 'contain' | 'cover' | 'none' | 'scale-down';
export type BlendModeName =
  | 'normal' | 'multiply' | 'screen' | 'overlay'
  | 'darken' | 'lighten' | 'color-dodge' | 'color-burn'
  | 'hard-light' | 'soft-light' | 'difference' | 'exclusion'
  | 'hue' | 'saturation' | 'color' | 'luminosity';

export type ShadowEffect = ShadowSpec & { inset?: boolean };

export type ResolvedStyle = {
  layout?: LayoutMode;
  direction?: FlexDir;
  gap?: number;
  padding?: Padding;
  width?: number | SizingMode;
  height?: number | SizingMode;
  bg?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  fontStyle?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textDecoration?: 'underline' | 'line-through';
  textTruncation?: 'ending';
  whiteSpace?: 'preserve' | 'preserve-line' | 'collapse';
  clipPathPolygon?: Array<{ x: number; y: number }>;
  radius?: number;
  corners?: Corners;
  borderWidth?: number;
  borderColor?: string;
  borderSides?: BorderSides;
  borderStyle?: BorderStyle;
  shadow?: ShadowSpec;
  shadows?: ShadowEffect[];
  layerBlur?: number;
  backgroundBlur?: number;
  blendMode?: BlendModeName;
  objectFit?: ObjectFit;
  align?: AxisAlign;       // counter-axis (items-*)
  justify?: AxisAlign;     // primary-axis (justify-*)
  position?: 'relative' | 'absolute' | 'fixed';
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  opacity?: number;
  // raw catch-all
  raw?: Record<string, string>;
};

// Computed style snapshot from a real browser (Playwright). All pixel values.
export type ComputedStyle = {
  display?: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  fontStyle?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: string;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderColor?: string;
  boxShadow?: string;
  opacity?: number;
  position?: string;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  zIndex?: number;
  // Bounding box from getBoundingClientRect (post-layout)
  rectX?: number;
  rectY?: number;
  rectW?: number;
  rectH?: number;
  // Backgrounds with image
  backgroundImage?: string;
  overflow?: string;
  transform?: string;
  textTransform?: string;
  textDecorationLine?: string;
  textDecorationStyle?: string;
  textDecorationColor?: string;
  backdropFilter?: string;
  filter?: string;
  mixBlendMode?: string;
  objectFit?: string;
  objectPosition?: string;
  borderTopStyle?: string;
  borderRightStyle?: string;
  borderBottomStyle?: string;
  borderLeftStyle?: string;
  borderRightColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  clipPath?: string;
  textOverflow?: string;
  whiteSpace?: string;
  listStyleType?: string;
  verticalAlign?: string;
};

export type IRNode = {
  tag: string;
  text?: string;
  attrs: Record<string, string>;
  classNames: string[];
  inlineStyle: Record<string, string>;
  style: ResolvedStyle;
  computed?: ComputedStyle;
  children: IRNode[];
};

export const TEXT_TAGS = new Set([
  'p', 'span', 'a', 'strong', 'em', 'b', 'i', 'small', 'label',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'td', 'th', 'caption', 'figcaption', 'blockquote', 'code', 'pre',
]);

export const VOID_TAGS = new Set([
  'img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area',
]);
