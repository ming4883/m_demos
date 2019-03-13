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
uniform sampler2D baseTextureSampler;
uniform samplerCube skyTextureSampler;
uniform mat4 worldView;

void main(void) {

    vec4 base = texture2D(baseTextureSampler, vUV);
    if (base.w < 0.1)
        discard;
    
    vec3 e = normalize( vec3( worldView * vPosition ) );
    vec3 n = normalize( worldView * vec4(vNormal, 0.0) ).xyz;
    
    vec3 sky = textureCube(skyTextureSampler, reflect(-e, n)).xyz;
    float d = dot(e, n);
    d = (d * d * 0.5 + 0.5);
    sky += d * 0.25;

    gl_FragColor = vec4(sky * base.xyz, 1.0);
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
        uniforms: ["world", "worldView", "worldViewProjection", "view", "projection" ],
    });
    mtl.backFaceCulling = false;
    return mtl;
}
};