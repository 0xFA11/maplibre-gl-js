import {StyleLayer} from '../style_layer';

import {FillExtrusionOutlineBucket} from '../../data/bucket/fill_extrusion_outline_bucket';
import {translateDistance} from '../query_utils';
import properties, {FillExtrusionPaintPropsPossiblyEvaluated} from './fill_extrusion_style_layer_properties.g';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties';
import {mat4} from 'gl-matrix';
import Point from '@mapbox/point-geometry';
import type {FeatureState, LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {BucketParameters} from '../../data/bucket';
import type {FillExtrusionPaintProps} from './fill_extrusion_style_layer_properties.g';
import type {IReadonlyTransform} from '../../geo/transform_interface';
import type {VectorTileFeature} from '@mapbox/vector-tile';

export class Point3D extends Point {
    z: number;
}

export class FillExtrusionOutlineStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<FillExtrusionPaintProps>;
    _transitioningPaint: Transitioning<FillExtrusionPaintProps>;
    paint: PossiblyEvaluated<FillExtrusionPaintProps, FillExtrusionPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    createBucket(parameters: BucketParameters<FillExtrusionOutlineStyleLayer>) {
        return new FillExtrusionOutlineBucket(parameters);
    }

    queryRadius(): number {
        return translateDistance(this.paint.get('fill-extrusion-translate'));
    }

    is3D(): boolean {
        return true;
    }

    queryIntersectsFeature(
        queryGeometry: Array<Point>,
        feature: VectorTileFeature,
        featureState: FeatureState,
        geometry: Array<Array<Point>>,
        zoom: number,
        transform: IReadonlyTransform,
        pixelsToTileUnits: number,
        pixelPosMatrix: mat4
    ): boolean | number {
        throw new Error("Feature doesn't implemented");
    }
}
