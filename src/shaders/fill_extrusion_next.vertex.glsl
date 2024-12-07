uniform vec3 u_extrusion_color;
uniform lowp float u_ambientintensity;
uniform vec3 u_sunlight_normal;
uniform lowp float u_opacity;

in vec3 a_pos;
in vec3 a_normal_ed;
in vec2 a_edge;

out float v_edge_distance;
out float v_height;
out float v_maxEdge;
flat out float v_maxHeight;

#ifdef TERRAIN3D
    in vec2 a_centroid;
#endif

out vec4 v_color;

#pragma mapbox: define highp float base
#pragma mapbox: define highp float height

void main() {
    #pragma mapbox: initialize highp float base
    #pragma mapbox: initialize highp float height

    vec3 normal = a_normal_ed.xyz;

    gl_Position = u_projection_matrix * vec4(a_pos.xyz, 1.0);

    vec3 normalForLighting = normalize(normal / 16384.0);


    float diffuseFactor = max(dot(normalForLighting, u_sunlight_normal), 0.0);
    diffuseFactor = mix(u_ambientintensity, 1.0, diffuseFactor);

    v_color = vec4(u_extrusion_color * diffuseFactor, 1.0);

    v_height = a_pos.z;
    v_edge_distance = a_edge.x;
    v_maxEdge = a_edge.y;
}

