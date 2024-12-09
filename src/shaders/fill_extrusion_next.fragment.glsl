uniform vec3 u_extrusion_line_color;
uniform float u_extrusion_vertical_line_width;
uniform float u_extrusion_horizontal_line_width;


in vec4 v_color;
in float v_edge_distance;
in float v_maxEdge;
in float v_height;
in float v_normal;
flat in float v_maxHeight;

void main() {
    float fw = max(fwidth(v_edge_distance), 1e-5);
    float fwHeight = max(fwidth(v_height), 1e-5);

    float radius = u_extrusion_vertical_line_width;

    float nearStart = 0.0;
    float nearEnd   = radius;
    float farStart  = v_maxEdge - radius;
    float farEnd    = v_maxEdge;

    float nearEdge = smoothstep(nearStart - fw, nearStart, v_edge_distance)
                   - smoothstep(nearEnd, nearEnd + fw, v_edge_distance);

    float farEdge = smoothstep(farStart - fw, farStart, v_edge_distance)
                  - smoothstep(farEnd, farEnd + fw, v_edge_distance);

    float totalEdgeFactor = v_maxEdge > 0.0 ? clamp(nearEdge + farEdge, 0.0, 1.0) : 0.0;

    radius = u_extrusion_horizontal_line_width;

    float topStart = 0.0;
    float topEnd   = radius;
    float bottomStart = v_maxHeight - radius;
    float bottomEnd   = v_maxHeight;

    float topEdge = smoothstep(topStart - fwHeight, topStart, v_height)
                  - smoothstep(topEnd, topEnd + fwHeight, v_height);

    float bottomEdge = smoothstep(bottomStart - fwHeight, bottomStart, v_height)
                     - smoothstep(bottomEnd, bottomEnd + fwHeight, v_height);

    float totalVerticalEdgeFactor = clamp(topEdge + bottomEdge, 0.0, 1.0);

    float combinedEdgeFactor = clamp(totalEdgeFactor + totalVerticalEdgeFactor, 0.0, 1.0);

    vec4 edgeColor = vec4(u_extrusion_line_color, 1.0);
    vec3 blendedColor = mix(v_color.rgb, edgeColor.rgb, combinedEdgeFactor);

    fragColor = vec4(blendedColor, v_color.a);
}

