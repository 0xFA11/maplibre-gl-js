uniform lowp float u_ambientintensity;
uniform vec3 u_sundirection;
uniform lowp float u_opacity;

in vec2 a_pos;
in vec4 a_normal_ed;

#ifdef TERRAIN3D
    in vec2 a_centroid;
#endif


out vec4 v_color;

#pragma mapbox: define highp float base
#pragma mapbox: define highp float height

#pragma mapbox: define highp vec4 color


void main() {
    #pragma mapbox: initialize highp float base
    #pragma mapbox: initialize highp float height
    #pragma mapbox: initialize highp vec4 color

    vec3 normal = a_normal_ed.xyz;

    float t = mod(normal.x, 2.0);
    float elevation = t > 0.0 ? height : base;
    vec2 posInTile = a_pos;

    gl_Position = u_projection_matrix * vec4(posInTile, elevation, 1.0);

    vec3 normalForLighting = normalize(normal / 16384.0);

    float ambientIntensity = u_ambientintensity;
    float diffuseFactor = max(dot(normalForLighting, u_sundirection), 0.0);
    diffuseFactor = mix(ambientIntensity, 1.0, diffuseFactor);

    v_color = vec4(color.rgb * diffuseFactor, 1.0);
}
