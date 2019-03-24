let shaderCloudAA = {
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
varying vec4 vPosition;

void main(void) {
    vec4 screenPosition = worldViewProjection * vec4(position, 1.0);
    screenPosition.z = screenPosition.w;

    gl_Position = screenPosition;
    vPosition = screenPosition;
}	        
`
,
FS : `
#ifdef GL_ES
precision highp float;
#endif

varying vec4 vPosition;

// Refs
uniform sampler2D cloudTextureSampler;
uniform vec4 cloudTextureSize;

void main(void) {

    vec2 uv = (vPosition.xy / vPosition.ww) * vec2(0.5) + vec2(0.5);

    vec4 t0 = texture2D(cloudTextureSampler, uv);
    vec4 t1 = texture2D(cloudTextureSampler, uv + cloudTextureSize.xy);
    vec4 t2 = texture2D(cloudTextureSampler, uv + cloudTextureSize.xy * vec2(1.0, 0.0));
    vec4 t3 = texture2D(cloudTextureSampler, uv + cloudTextureSize.xy * vec2(0.0, 1.0));

    gl_FragColor = (t0 + t1 + t2 + t3) * 0.25;
}    
`,
create : function(scene) {
    let shaderName = "cloudAA";
    BABYLON.Effect.ShadersStore[shaderName + "VertexShader"] = this.VS;
    BABYLON.Effect.ShadersStore[shaderName + "FragmentShader"] = this.FS;
    
    let mtl = new BABYLON.ShaderMaterial(shaderName, scene, {
        vertexElement: shaderName,
        fragmentElement: shaderName,
    },
    {
        attributes: ["position", "normal", "uv"],
        uniforms: ["world", "worldView", "worldViewProjection", "view", "projection"],
    });
    mtl.backFaceCulling = false;
    mtl.alpha = 0.5;
    mtl.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
    return mtl;
}
};