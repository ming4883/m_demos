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
uniform vec3 sunDir;

// Normal
varying vec4 vPosition;
varying vec2 vSunDir;

void main(void) {
    vec4 screenPosition = worldViewProjection * vec4(position, 1.0);
    screenPosition.z = screenPosition.w;

    gl_Position = screenPosition;
    vPosition = screenPosition;

    vec4 sunPosition = worldViewProjection * vec4(position + sunDir * 10.0, 1.0);
    vSunDir = sunPosition.xy - screenPosition.xy;
}	        
`
,
FS : `
#ifdef GL_ES
precision highp float;
#endif

varying vec4 vPosition;
varying vec2 vSunDir;

// Refs
uniform sampler2D cloudTextureSampler;
uniform vec4 cloudTextureSize;
uniform float iTime;

#define W0 0.5545497
#define W1 0.308517
#define W3 0.618034

// 2D integer (offset by 0.5) -> ~triangle distribution
float tnoise(in vec2 c)
{   
  c = c*fract(c*vec2(W0,W1));  // nested Weyl
  float p  = c.x*c.y;          // combine 1D partial results
  float i  = floor(p);         // integer part
  float u0 = p-i;              // fractional part = sample 1
  float u1 = fract(W3*i);      // simple Weyl from int part = sample 2
  return 0.5*(u0+u1);          // combine samples
}

void main(void) {

    vec2 UV = (vPosition.xy / vPosition.ww) * vec2(0.5) + vec2(0.5);

    vec2 UVDelta = normalize(vSunDir) * 16.0 * cloudTextureSize.xy;
    int Steps = 16;
    float StepsInv = 1.0 / float(Steps);
    float Decay = 1.5;
    
    float Jitter = tnoise((UV + vec2(fract(iTime))) * 1024.0);
    vec2 dUV = UVDelta * StepsInv * Jitter;
    vec2 P = UV;
    vec4 T = vec4(0.0);
    vec4 Dens0 = texture2D(cloudTextureSampler, P);

    for(int i = 0; i < Steps; ++i) {
        float h = float(i) * StepsInv;
        P +=  dUV * (1.0 + h); // increase step size for each step

        if (P.x < 0.0 || P.x > 1.0 || P.y < 0.0 || P.y > 1.0)
            break;

   		vec4 Dens = texture2D(cloudTextureSampler, P);
        vec4 dDens = Dens0 - Dens;
        dDens = clamp(dDens, 0.0, 1.0);
        dDens = vec4(1.0) - dDens;
        dDens = dDens * dDens;
        
        dDens = exp(-Decay * dDens);
        T += clamp(dDens, 0.0, 1.0) * StepsInv;
    }
    T.a = Dens0.a * Dens0.a;
    gl_FragColor = T;
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