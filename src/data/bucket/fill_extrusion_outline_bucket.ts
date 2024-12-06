import {FillExtrusionLayoutArray} from '../array_types.g';

import {members as layoutAttributes} from './fill_extrusion_next_attributes';
import {Segment, SegmentVector} from '../segment';
import {ProgramConfigurationSet} from '../program_configuration';
import {TriangleIndexArray} from '../index_array_type';
import {EXTENT} from '../extent';
import mvt from '@mapbox/vector-tile';
const vectorTileFeatureTypes = mvt.VectorTileFeature.types;
import {classifyRings} from '@maplibre/maplibre-gl-style-spec';
const EARCUT_MAX_RINGS = 500;
import {register} from '../../util/web_worker_transfer';
import {loadGeometry} from '../load_geometry';
import {toEvaluationFeature} from '../evaluation_feature';
import {EvaluationParameters} from '../../style/evaluation_parameters';

import type {CanonicalTileID} from '../../source/tile_id';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters
} from '../bucket';

import type {Context} from '../../gl/context';
import type {IndexBuffer} from '../../gl/index_buffer';
import type {VertexBuffer} from '../../gl/vertex_buffer';
import Point from '@mapbox/point-geometry';
import type {FeatureStates} from '../../source/source_state';
import type {ImagePosition} from '../../render/image_atlas';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import {subdivideVertexLine} from '../../render/subdivision';
import type {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import { FillExtrusionOutlineStyleLayer } from '../../style/style_layer/fill_extrusion_outline_style';

function addVertex(vertexArray, x, y, z) {
    vertexArray.emplaceBack(x, y, z);
}

export class FillExtrusionOutlineBucket implements Bucket {
    index: number;
    zoom: number;
    overscaling: number;
    layers: Array<FillExtrusionOutlineStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<FillExtrusionOutlineStyleLayer>;
    stateDependentLayerIds: Array<string>;

    layoutVertexArray: FillExtrusionLayoutArray;
    layoutVertexBuffer: VertexBuffer;
    hasPattern: boolean;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    programConfigurations: ProgramConfigurationSet<FillExtrusionOutlineStyleLayer>;
    segments: SegmentVector;
    uploaded: boolean;
    features: Array<BucketFeature>;

    constructor(options: BucketParameters<FillExtrusionOutlineStyleLayer>) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasPattern = false;

        this.layoutVertexArray = new FillExtrusionLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.segments = new SegmentVector();
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID) {
        this.features = [];

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical)) continue;

            const bucketFeature: BucketFeature = {
                id,
                sourceLayerIndex,
                index,
                geometry: needGeometry ? evaluationFeature.geometry : loadGeometry(feature),
                properties: feature.properties,
                type: feature.type,
                patterns: {}
            };

            this.addFeature(bucketFeature, bucketFeature.geometry, index, canonical, {}, options.subdivisionGranularity);
            options.featureIndex.insert(feature, bucketFeature.geometry, index, sourceLayerIndex, this.index, true);
        }
    }

    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: {[_: string]: ImagePosition}) {
        for (const feature of this.features) {
            const {geometry} = feature;
            this.addFeature(feature, geometry, feature.index, canonical, imagePositions, options.subdivisionGranularity);
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, imagePositions: {[_: string]: ImagePosition}) {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, imagePositions);
    }

    isEmpty() {
        return this.layoutVertexArray.length === 0;
    }

    uploadPending() {
        return !this.uploaded || this.programConfigurations.needsUpload;
    }

    upload(context: Context) {
        if (!this.uploaded) {
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, layoutAttributes);
            this.indexBuffer = context.createIndexBuffer(this.indexArray);
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: {[_: string]: ImagePosition}, subdivisionGranularity: SubdivisionGranularitySetting) {
        for (const polygon of classifyRings(geometry, EARCUT_MAX_RINGS)) {
            this.processPolygon(canonical, feature, polygon, subdivisionGranularity);
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, imagePositions, canonical);
    }

    private processPolygon(
        canonical: CanonicalTileID,
        feature: BucketFeature,
        polygon: Array<Array<Point>>,
        subdivisionGranularity: SubdivisionGranularitySetting
    ): void {
        if (polygon.length < 1) {
            return;
        }

        if (isEntirelyOutside(polygon[0])) {
            return;
        }

        // Only consider the un-subdivided polygon outer ring for centroid calculation
        for (const ring of polygon) {
            if (ring.length === 0) {
                continue;
            }
        }

        const segmentReference = {
            segment: this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray)
        };
        const granularity = subdivisionGranularity.fill.getGranularityForZoomLevel(canonical.z);
        const isPolygon = vectorTileFeatureTypes[feature.type] === 'Polygon';
        const featureHeight = Math.max(feature.properties.render_height, 15);

        for (const ring of polygon) {
            if (ring.length === 0) {
                continue;
            }

            if (isEntirelyOutside(ring)) {
                continue;
            }

            const subdividedRing = subdivideVertexLine(ring, granularity, isPolygon);
            this._generateSideFaces(subdividedRing, segmentReference, featureHeight);
        }
    }

private _generateSideFaces(
    geometry: Array<Point>,
    segmentReference: { segment: Segment },
    sideFaceHeight: number
) {
    const numPoints = geometry.length;

    if (numPoints < 2) {
        return;
    }

    const lineThickness = 3;

    let edgeSegment = this.segments.prepareSegment(0, this.layoutVertexArray, this.indexArray);

    for (let p = 0; p < numPoints; p++) {
        const p1 = geometry[p];
        const p2 = geometry[(p + 1) % numPoints];

        const edgeVec = p2.sub(p1);
        const dir = edgeVec.unit();
        const perp = new Point(-dir.y, dir.x);
        const offset = perp.mult(lineThickness / 2);

        const b0 = new Point(p1.x + offset.x, p1.y + offset.y);
        const b1 = new Point(p1.x - offset.x, p1.y - offset.y);
        const t0 = new Point(b0.x, b0.y);
        const t1 = new Point(b1.x, b1.y);
        const t2 = new Point(p2.x + offset.x, p2.y + offset.y);
        const t3 = new Point(p2.x - offset.x, p2.y - offset.y)

        if (edgeSegment.vertexLength + 6 > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
            edgeSegment = this.segments.prepareSegment(6, this.layoutVertexArray, this.indexArray);
        }

        const vertexStartIndex = edgeSegment.vertexLength;

        addVertex(this.layoutVertexArray, t0.x, t0.y, sideFaceHeight);
        addVertex(this.layoutVertexArray, t1.x, t1.y, sideFaceHeight);
        addVertex(this.layoutVertexArray, t2.x, t2.y, sideFaceHeight);
        addVertex(this.layoutVertexArray, t3.x, t3.y, sideFaceHeight);

        addVertex(this.layoutVertexArray, b0.x, b0.y, 0);
        addVertex(this.layoutVertexArray, b1.x, b1.y, 0);

        edgeSegment.vertexLength += 6;

        this.indexArray.emplaceBack(vertexStartIndex + 0, vertexStartIndex + 1, vertexStartIndex + 2);
        this.indexArray.emplaceBack(vertexStartIndex + 1, vertexStartIndex + 3, vertexStartIndex + 2);

        this.indexArray.emplaceBack(vertexStartIndex + 4, vertexStartIndex + 5, vertexStartIndex + 1);
        this.indexArray.emplaceBack(vertexStartIndex + 4, vertexStartIndex + 1, vertexStartIndex + 0);

        edgeSegment.primitiveLength += 4;
    }
}
}

register('FillExtrusionOutlineBucket', FillExtrusionOutlineBucket, {omit: ['layers', 'features']});

function isEntirelyOutside(ring) {
    return ring.every(p => p.x < 0) ||
        ring.every(p => p.x > EXTENT) ||
        ring.every(p => p.y < 0) ||
        ring.every(p => p.y > EXTENT);
}
