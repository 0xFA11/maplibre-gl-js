import {
    Uniform1f,
    Uniform3f
} from '../uniform_binding';

import type {Context} from '../../gl/context';
import type {Painter} from '../painter';
import type {UniformValues, UniformLocations} from '../uniform_binding';

export type FillExtrusionNextUniformsType = {
    'u_extrusion_color': Uniform3f;
    'u_ambientintensity': Uniform1f;
    'u_sunlight_normal': Uniform3f;
    'u_opacity': Uniform1f;
};

const fillExtrusionNextUniforms = (context: Context, locations: UniformLocations): FillExtrusionNextUniformsType => ({
    'u_extrusion_color': new Uniform3f(context, locations.u_extrusion_color),
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
        'u_ambientintensity': painter.style.ambientIntensity,
        'u_sunlight_normal': painter.style.sunLightNormal,
        'u_opacity': opacity,
    };
};

export {
    fillExtrusionNextUniforms,
    fillExtrusionNextUniformValues
};
