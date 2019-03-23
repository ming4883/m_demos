let shaderCustomVisualize = {
VS : `
#ifdef GL_ES
#version 300 es
precision highp float;
#endif

// Attributes
in vec3 position;
in vec2 uv;
in vec3 normal;

// Uniforms
uniform mat4 worldViewProjection;

// Normal
out vec2 vUV;
out vec4 vPosition;
out vec3 vNormal;

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
#version 300 es
precision highp float;
#endif

in vec2 vUV;
in vec4 vPosition;
in vec3 vNormal;

out vec4 out_FragColor;

// Refs
uniform sampler2D baseTextureSampler;
uniform samplerCube skyTextureSampler;
uniform mat4 worldView;

void main(void) {

    vec4 base = texture(baseTextureSampler, vUV);
    if (base.w < 0.1)
        discard;
    
    vec3 e = normalize( vec3( worldView * vPosition ) );
    vec3 n = normalize( worldView * vec4(vNormal, 0.0) ).xyz;
    
    vec3 sky = textureLod(skyTextureSampler, reflect(-e, n), 0.0).xyz;
    float d = dot(e, n);
    d = (d * d * 0.5 + 0.5);
    sky += d * 0.125 + textureLod(skyTextureSampler, -n, 3.0).xyz;

    out_FragColor = vec4(sky * base.xyz, 1.0);
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
    //mtl.backFaceCulling = false;
    return mtl;
}
};