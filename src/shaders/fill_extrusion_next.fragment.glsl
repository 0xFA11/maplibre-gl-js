in vec4 v_color;
in float v_edge_distance;
in float v_height;

in float v_maxEdge;
flat in float v_maxHeight;

void main() {
    float edgeWidth = fwidth(v_edge_distance) * 0.5;

    float nearStart = 0.0;
    float nearEnd = 1.0;
    float farStart = v_maxEdge - 1.0;
    float farEnd = v_maxEdge;

    float nearEdge = 1.0 - smoothstep(nearStart - edgeWidth,
                                      nearEnd + edgeWidth,
                                      v_edge_distance);

    float farEdge = smoothstep(farStart - edgeWidth,
                               farEnd + edgeWidth,
                               v_edge_distance);

    float edgeHeight = fwidth(v_height) * 0.5;

    float bottomStart = 0.0;
    float bottomEnd = 0.15;
    float topStart = v_maxHeight - 0.15;
    float topEnd = v_maxHeight;

    float bottomEdge = 1.0 - smoothstep(bottomStart - edgeHeight,
                                        bottomEnd + edgeHeight,
                                        v_height);

    float topEdge = smoothstep(topStart - edgeHeight,
                               topEnd + edgeHeight,
                               v_height);

    float totalEdgeFactor = nearEdge + farEdge + topEdge + bottomEdge;
    totalEdgeFactor = clamp(totalEdgeFactor, 0.0, 1.0);

    const float gamma = 2.2;
    vec4 edgeColor = vec4(0.282, 0.282, 0.282, 1.0);

    vec3 edgeColorGamma = pow(edgeColor.rgb, vec3(gamma));
    vec3 vColorGamma = pow(v_color.rgb, vec3(gamma));

    vec3 blendedColorGamma = (nearEdge * edgeColorGamma) +
                             (farEdge * edgeColorGamma) +
                             (topEdge * edgeColorGamma) +
                             (bottomEdge * edgeColorGamma) +
                             ((1.0 - totalEdgeFactor) * vColorGamma);

    vec3 blendedColor = pow(blendedColorGamma, vec3(1.0 / gamma));

    fragColor = vec4(blendedColor, v_color.a);
}

