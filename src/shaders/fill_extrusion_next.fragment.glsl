in vec4 v_color;
in float v_edge_distance;
in float v_maxEdge;

void main() {
    float fw = max(fwidth(v_edge_distance), 1e-5);

    float nearStart = 0.0;
    float nearEnd   = 1.0;
    float farStart  = v_maxEdge - 1.0;
    float farEnd    = v_maxEdge;

    float nearEdge = smoothstep(nearStart - fw, nearStart, v_edge_distance)
                   - smoothstep(nearEnd, nearEnd + fw, v_edge_distance);

    float farEdge = smoothstep(farStart - fw, farStart, v_edge_distance)
                  - smoothstep(farEnd, farEnd + fw, v_edge_distance);

    float totalEdgeFactor = clamp(nearEdge + farEdge, 0.0, 1.0);

    vec4 edgeColor = vec4(0.282, 0.282, 0.282, 1.0);
    vec3 blendedColor = mix(v_color.rgb, edgeColor.rgb, totalEdgeFactor);

    fragColor = vec4(blendedColor, v_color.a);
    float dbg = smoothstep(0.0 - fw, 0.0, v_edge_distance) - smoothstep(0.5, 0.5 + fw, v_edge_distance);
}

