import {
    Uniform1f,
    Uniform3f
} from '../uniform_binding';

import type {Context} from '../../gl/context';
import type {Painter} from '../painter';
import type {UniformValues, UniformLocations} from '../uniform_binding';

export type FillExtrusionNextUniformsType = {
    'u_extrusion_color': Uniform3f;
    'u_extrusion_line_color': Uniform3f;
    'u_extrusion_vertical_line_width': Uniform1f;
    'u_extrusion_horizontal_line_width': Uniform1f;
    'u_ambientintensity': Uniform1f;
    'u_sunlight_normal': Uniform3f;
    'u_opacity': Uniform1f;
};

const fillExtrusionNextUniforms = (context: Context, locations: UniformLocations): FillExtrusionNextUniformsType => ({
    'u_extrusion_color': new Uniform3f(context, locations.u_extrusion_color),
    'u_extrusion_line_color': new Uniform3f(context, locations.u_extrusion_line_color),
    'u_extrusion_vertical_line_width': new Uniform1f(context, locations.u_extrusion_vertical_line_width),
    'u_extrusion_horizontal_line_width': new Uniform1f(context, locations.u_extrusion_horizontal_line_width),
    'u_ambientintensity': new Uniform1f(context, locations.u_ambientintensity),
    'u_sunlight_normal': new Uniform3f(context, locations.u_sunlight_normal),
    'u_opacity': new Uniform1f(context, locations.u_opacity),
});

const fillExtrusionNextUniformValues = (
    painter: Painter,
    opacity: number,
): UniformValues<FillExtrusionNextUniformsType> => {
    return {
        'u_extrusion_color': painter.style.extrusionColor,
        'u_extrusion_line_color': painter.style.extrusionLineColor,
        'u_extrusion_vertical_line_width': painter.style.extrusionVerticalLineWidth,
        'u_extrusion_horizontal_line_width': painter.style.extrusionHorizontalLineWidth,
        'u_ambientintensity': painter.style.ambientIntensity,
        'u_sunlight_normal': painter.style.sunLightNormal,
        'u_opacity': opacity,
    };
};

export {
    fillExtrusionNextUniforms,
    fillExtrusionNextUniformValues
};
