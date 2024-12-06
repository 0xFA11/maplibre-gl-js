import type {CircleStyleLayer} from './circle_style_layer';
import type {FillStyleLayer} from './fill_style_layer';
import type {FillExtrusionStyleLayer} from './fill_extrusion_style_layer';
import type {HeatmapStyleLayer} from './heatmap_style_layer';
import type {HillshadeStyleLayer} from './hillshade_style_layer';
import type {LineStyleLayer} from './line_style_layer';
import type {SymbolStyleLayer} from './symbol_style_layer';
import { FillExtrusionNextStyleLayer } from './fill_extrusion_next_style_layer';
import { FillExtrusionOutlineStyleLayer } from './fill_extrusion_outline_style';

export type TypedStyleLayer = CircleStyleLayer | FillStyleLayer | FillExtrusionStyleLayer | FillExtrusionNextStyleLayer | FillExtrusionOutlineStyleLayer  | HeatmapStyleLayer | HillshadeStyleLayer | LineStyleLayer | SymbolStyleLayer;
