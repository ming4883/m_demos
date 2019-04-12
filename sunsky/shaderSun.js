let shaderSun = {
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
    vec4 screenPosition = worldViewProjection * vPosition;
    screenPosition.z = screenPosition.w;
    gl_Position = screenPosition;
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
uniform mat4 world;
uniform vec3 sunDir;
uniform vec4 sunParams;

void main(void) {

    vec3 viewDir  		= normalize( vec3( world * vPosition ) );
	float sunIntensity  = max(0.0, dot(viewDir, sunDir));
	sunIntensity 		= min(1.0, pow(sunIntensity, 1500.0) * 5.0) * sunParams.w;
	gl_FragColor 		= vec4(0.0);//vec4( sunParams.xyz * sunIntensity, 1.0 );
}    
`,
create : function(scene) {
    let shaderName = "sun";
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
    mtl.alphaMode = BABYLON.Engine.ALPHA_ADD;
    return mtl;
}
};