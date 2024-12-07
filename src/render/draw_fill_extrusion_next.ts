import {DepthMode} from '../gl/depth_mode';
import {StencilMode} from '../gl/stencil_mode';
import {ColorMode} from '../gl/color_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {
    fillExtrusionNextUniformValues,
} from './program/fill_extrusion_next_program';

import type {Painter} from './painter';
import type {SourceCache} from '../source/source_cache';
import type {FillExtrusionStyleLayer} from '../style/style_layer/fill_extrusion_style_layer';
import type {OverscaledTileID} from '../source/tile_id';

import {FillExtrusionNextBucket} from '../data/bucket/fill_extrusion_next_bucket';

export function drawFillExtrusionNext(painter: Painter, source: SourceCache, layer: FillExtrusionStyleLayer, coords: Array<OverscaledTileID>) {
    const opacity = layer.paint.get('fill-extrusion-opacity');
    if (opacity === 0) {
        return;
    }

    if (painter.renderPass === 'translucent') {
        const depthMode = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);

        if (opacity === 1 && !layer.paint.get('fill-extrusion-pattern').constantOr(1 as any)) {
            const colorMode = painter.colorModeForRenderPass();
            drawExtrusionTiles(painter, source, layer, coords, depthMode, StencilMode.disabled, colorMode);

        } else {
            // Draw transparent buildings in two passes so that only the closest surface is drawn.
            // First draw all the extrusions into only the depth buffer. No colors are drawn.
            drawExtrusionTiles(painter, source, layer, coords, depthMode,
                StencilMode.disabled,
                ColorMode.disabled);

            // Then draw all the extrusions a second type, only coloring fragments if they have the
            // same depth value as the closest fragment in the previous pass. Use the stencil buffer
            // to prevent the second draw in cases where we have coincident polygons.
            drawExtrusionTiles(painter, source, layer, coords, depthMode,
                painter.stencilModeFor3D(),
                painter.colorModeForRenderPass());
        }
    }
}

function drawExtrusionTiles(
    painter: Painter,
    source: SourceCache,
    layer: FillExtrusionStyleLayer,
    coords: OverscaledTileID[],
    depthMode: DepthMode,
    stencilMode: Readonly<StencilMode>,
    colorMode: Readonly<ColorMode>) {
    const context = painter.context;
    const opacity = layer.paint.get('fill-extrusion-opacity');
    const transform = painter.transform;

    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket: FillExtrusionNextBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram('fillExtrusionNext', programConfiguration);

        const projectionData = transform.getProjectionData({overscaledTileID: coord});
        const uniformValues = fillExtrusionNextUniformValues(painter, opacity);

        program.draw(context, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues, null, projectionData, layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
            bucket.segments, layer.paint, painter.transform.zoom,
            programConfiguration, null);
    }
}
