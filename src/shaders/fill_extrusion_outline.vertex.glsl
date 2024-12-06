uniform vec3 u_extrusion_color;
uniform lowp float u_ambientintensity;
uniform vec3 u_sunlight_normal;
uniform lowp float u_opacity;

in vec3 a_pos;

#ifdef TERRAIN3D
    in vec2 a_centroid;
#endif


out vec4 v_color;

void main() {
    gl_Position = u_projection_matrix * vec4(a_pos, 1.0);
    v_color = vec4(u_extrusion_color, 1.0);
}
