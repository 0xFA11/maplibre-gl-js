import {FillExtrusionNextLayoutArray} from '../array_types.g';

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
import type Point from '@mapbox/point-geometry';
import type {FeatureStates} from '../../source/source_state';
import type {ImagePosition} from '../../render/image_atlas';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import {subdividePolygon, subdivideVertexLine} from '../../render/subdivision';
import type {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import {fillLargeMeshArrays} from '../../render/fill_large_mesh_arrays';
import { FillExtrusionNextStyleLayer } from '../../style/style_layer/fill_extrusion_next_style_layer';

// The factor (8192) scales floating-point numbers to integers for vertex stage
const FACTOR = Math.pow(2, 13);

function addVertex(vertexArray, x, y, z, nx, ny, nz, e, max) {
    vertexArray.emplaceBack(
        // a_pos
        x,
        y,
        z,
        // a_normal
        nx * FACTOR * 2,
        ny * FACTOR * 2,
        nz * FACTOR * 2,
        // a_edge
        Math.round(e),
        Math.round(max)
    );
}

export class FillExtrusionNextBucket implements Bucket {
    index: number;
    zoom: number;
    overscaling: number;
    layers: Array<FillExtrusionNextStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<FillExtrusionNextStyleLayer>;
    stateDependentLayerIds: Array<string>;

    layoutVertexArray: FillExtrusionNextLayoutArray;
    layoutVertexBuffer: VertexBuffer;
    hasPattern: boolean;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    programConfigurations: ProgramConfigurationSet<FillExtrusionNextStyleLayer>;
    segments: SegmentVector;
    uploaded: boolean;
    features: Array<BucketFeature>;

    constructor(options: BucketParameters<FillExtrusionNextStyleLayer>) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasPattern = false;

        this.layoutVertexArray = new FillExtrusionNextLayoutArray();
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

        // Only triangulate and draw the area of the feature if it is a polygon
        // Other feature types (e.g. LineString) do not have area, so triangulation is pointless / undefined
        if (!isPolygon)
            return;

        // Do not generate outlines, since outlines already got subdivided earlier.
        const subdividedPolygon = subdividePolygon(polygon, canonical, granularity, false);
        const vertexArray = this.layoutVertexArray;

        fillLargeMeshArrays(
            (x, y) => {
                addVertex(vertexArray, x, y, featureHeight, 0, 0, 1, 0, 0);
            },
            this.segments,
            this.layoutVertexArray,
            this.indexArray,
            subdividedPolygon.verticesFlattened,
            subdividedPolygon.indicesTriangles
        );
    }

    /**
     * Generates side faces for the supplied geometry. Assumes `geometry` to be a line string, like the output of {@link subdivideVertexLine}.
     * For rings, it is assumed that the first and last vertex of `geometry` are equal.
     */
    private _generateSideFaces(geometry: Array<Point>, segmentReference: {segment: Segment}, sideFaceHeight: number) {

        for (let p = 1; p < geometry.length; p++) {
            let edgeDistance = 0;
            const p1 = geometry[p];
            const p2 = geometry[p - 1];

            if (isBoundaryEdge(p1, p2)) {
                continue;
            }

            if (segmentReference.segment.vertexLength + 4 > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
                segmentReference.segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
            }

            const perp = p1.sub(p2)._perp()._unit();
            const dist = p2.dist(p1);
            if (edgeDistance + dist > 32768) edgeDistance = 0;

            const maxEdgeDist = dist;

            addVertex(this.layoutVertexArray, p1.x, p1.y, 0, perp.x, perp.y, 0, edgeDistance, maxEdgeDist);
            addVertex(this.layoutVertexArray, p1.x, p1.y, sideFaceHeight, perp.x, perp.y, 0, edgeDistance, maxEdgeDist);

            edgeDistance = dist;

            addVertex(this.layoutVertexArray, p2.x, p2.y, 0, perp.x, perp.y, 0, edgeDistance, maxEdgeDist);
            addVertex(this.layoutVertexArray, p2.x, p2.y, sideFaceHeight, perp.x, perp.y, 0, edgeDistance, maxEdgeDist);

            const bottomRight = segmentReference.segment.vertexLength;

            // ┌──────┐
            // │ 0  1 │ Counter-clockwise winding order.
            // │      │ Triangle 1: 0 => 2 => 1
            // │ 2  3 │ Triangle 2: 1 => 2 => 3
            // └──────┘
            this.indexArray.emplaceBack(bottomRight, bottomRight + 2, bottomRight + 1);
            this.indexArray.emplaceBack(bottomRight + 1, bottomRight + 2, bottomRight + 3);

            segmentReference.segment.vertexLength += 4;
            segmentReference.segment.primitiveLength += 2;
        }
    }
}

register('FillExtrusionBucketNext', FillExtrusionNextBucket, {omit: ['layers', 'features']});

function isBoundaryEdge(p1, p2) {
    return (p1.x === p2.x && (p1.x < 0 || p1.x > EXTENT)) ||
        (p1.y === p2.y && (p1.y < 0 || p1.y > EXTENT));
}

function isEntirelyOutside(ring) {
    return ring.every(p => p.x < 0) ||
        ring.every(p => p.x > EXTENT) ||
        ring.every(p => p.y < 0) ||
        ring.every(p => p.y > EXTENT);
}
