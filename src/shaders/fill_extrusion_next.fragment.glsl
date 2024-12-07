uniform vec3 u_extrusion_line_color;
in vec4 v_color;
in float v_edge_distance;
in float v_maxEdge;

void main() {
    float fw = max(fwidth(v_edge_distance), 1e-5);

    float radius = 1.0;

    float nearStart = 0.0;
    float nearEnd   = radius;
    float farStart  = v_maxEdge - radius;
    float farEnd    = v_maxEdge;

    float nearEdge = smoothstep(nearStart - fw, nearStart, v_edge_distance)
                   - smoothstep(nearEnd, nearEnd + fw, v_edge_distance);

    float farEdge = smoothstep(farStart - fw, farStart, v_edge_distance)
                  - smoothstep(farEnd, farEnd + fw, v_edge_distance);

    float totalEdgeFactor = v_maxEdge > 0.0 ? clamp(nearEdge + farEdge, 0.0, 1.0) : 0.0;

    vec4 edgeColor = vec4(u_extrusion_line_color, 1.0);
    vec3 blendedColor = mix(v_color.rgb, edgeColor.rgb, totalEdgeFactor);

    fragColor = vec4(blendedColor, v_color.a);
}
