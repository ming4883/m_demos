let shaderCustomDepth = {
VS : `
#ifdef GL_ES
precision highp float;
#endif

attribute vec3 position;
uniform mat4 worldViewProjection;
void main(void) {
    gl_Position = worldViewProjection * vec4(position, 1.0);
};
`,
FS : `
#ifdef GL_ES
precision highp float;
#endif

void main(void) {
    float depth =  1.0 - (2.0 / (100.0 + 1.0 - gl_FragCoord.z * (100.0 - 1.0)));
    gl_FragColor = vec4(depth, depth, depth, 1.0);
}
`
};