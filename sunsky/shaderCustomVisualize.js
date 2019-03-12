let shaderCustomVisualize = {
VS : `
#ifdef GL_ES
precision highp float;
#endif

// Attributes
attribute vec3 position;
attribute vec2 uv;
attribute vec3 normal;

// Uniforms
uniform mat4 worldViewProjection;

// Normal
varying vec2 vUV;
varying vec4 vPosition;
varying vec3 vNormal;

void main(void) {
    vUV = uv;
    vNormal = normal;
    vPosition = vec4(position, 1.0);
    gl_Position = worldViewProjection * vPosition;
}	        
`
,
FS : `
#ifdef GL_ES
precision highp float;
#endif

varying vec2 vUV;
varying vec4 vPosition;
varying vec3 vNormal;

// Refs
uniform sampler2D textureSampler;
uniform mat4 worldView;

void main(void) {

    vec3 e = normalize( vec3( worldView * vPosition ) );
    vec3 n = normalize( worldView * vec4(vNormal, 0.0) ).xyz;
    float d = dot(e, n);
    d = (d * d * 0.5 + 0.5);

    vec3 tex = texture2D(textureSampler, vUV).xyz;
    gl_FragColor = vec4(d * tex, 1.0);
}    
`,
create : function(scene) {
    let shaderName = "customVisualize";
    BABYLON.Effect.ShadersStore[shaderName + "VertexShader"] = this.VS;
    BABYLON.Effect.ShadersStore[shaderName + "FragmentShader"] = this.FS;
    
    let mtl = new BABYLON.ShaderMaterial(shaderName, scene, {
        vertexElement: shaderName,
        fragmentElement: shaderName,
    },
    {
        attributes: ["position", "normal", "uv"],
        uniforms: ["world", "worldView", "worldViewProjection", "view", "projection", "time", "direction" ],
        samplers: ["textureSampler"],
    });
    mtl.backFaceCulling = false;
    return mtl;
}
};