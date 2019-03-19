let shaderCloud = {
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
    //screenPosition.z = -1.0;
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
uniform samplerCube skyTextureSampler;
uniform float iTime;
uniform mat4 world;
uniform mat4 worldView;

// -----------------------------------------------
const float cloudcover = 0.2;
const float cloudalpha = 8.0;

/*
const float cloudscale = 0.002;
const float cloudspeed = 0.02;
const float clouddark = 0.5;
const float cloudlight = 0.6;
const float cloudskytint = 1.0;
*/

uniform float cloudscale;
uniform float cloudspeed;
uniform float clouddark;
uniform float cloudlight;
uniform float cloudskytint;

const mat2 m = mat2( 1.6,  1.2, -1.2,  1.6 );

vec2 hash( vec2 p ) {
	p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
	return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

float noise( in vec2 p ) {
    const float K1 = 0.366025404; // (sqrt(3)-1)/2;
    const float K2 = 0.211324865; // (3-sqrt(3))/6;
	vec2 i = floor(p + (p.x+p.y)*K1);	
    vec2 a = p - i + (i.x+i.y)*K2;
    vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0); //vec2 of = 0.5 + 0.5*vec2(sign(a.x-a.y), sign(a.y-a.x));
    vec2 b = a - o + K2;
	vec2 c = a - 1.0 + 2.0*K2;
    vec3 h = max(0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
	vec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
    return dot(n, vec3(70.0));	
}

float fbm(vec2 n) {
	float total = 0.0, amplitude = 0.1;
	for (int i = 0; i < 7; i++) {
		total += noise(n) * amplitude;
		n = m * n;
		amplitude *= 0.4;
	}
	return total;
}

float npr(float f) {
    return clamp(f, 0.0, 1.0);
    //return 1.0 - (1.0-f) * (1.0-f);
}

// -----------------------------------------------

void main(void) {
    vec2 p = (world * vPosition).xz;
	vec2 uv = p;
    float time = iTime * cloudspeed;
    float q = fbm(uv * cloudscale * 0.5);
    
    //ridged noise shape
	float r = 0.0;
	uv *= cloudscale;
    uv -= q - time;
    float weight = 0.8;
    for (int i=0; i<8; i++){
		r += abs(weight*noise( uv ));
        uv = m*uv + time;
		weight *= 0.7;
    }
    
    //noise shape
	float f = 0.0;
    uv = p;
	uv *= cloudscale;
    uv -= q - time;
    weight = 0.7;
    for (int i=0; i<8; i++){
		f += weight*noise( uv );
        uv = m*uv + time;
		weight *= 0.6;
    }
    
    f *= r + f;
    
    //noise color
    float c = 0.0;
    time = iTime * cloudspeed * 2.0;
    uv = p;
	uv *= cloudscale*2.0;
    uv -= q - time;
    weight = 0.4;
    for (int i=0; i<7; i++){
		c += (weight*noise( uv ));
        uv = m*uv + time;
		weight *= 0.6;
    }
    
    //noise ridge color
    float c1 = 0.0;
    time = iTime * cloudspeed * 3.0;
    uv = p;
	uv *= cloudscale*3.0;
    uv -= q - time;
    weight = 0.4;
    for (int i=0; i<7; i++){
		c1 += (abs(weight*noise( uv )));
        uv = m*uv + time;
		weight *= 0.6;
    }
	
    c += c1;
    
    vec3 e = normalize((world * vPosition).xyz);
    e.y *= -1.0;

    vec3 skycolor = textureCube(skyTextureSampler, e).xyz;

    vec3 cloudcolor = vec3(1.1, 1.1, 1.1) * clamp((clouddark + cloudlight*c), 0.0, 1.0);
   
    f = cloudcover + cloudalpha * f * r;
    f = clamp(f + c, 0.0, 1.0);

    // PS screen blend mode
    vec3 result = vec3(1.0) - clamp(vec3(1.0) - skycolor, vec3(0.1), vec3(1.0)) * (vec3(1.0) - cloudcolor);
    result *= (cloudskytint + skycolor);
    
    // depth fade
    float d = (worldView * vPosition).z;
    d = 1.0 - clamp(d / 4000.0, 0.0, 1.0);

    // final output
	gl_FragColor = vec4(result, d * f);
}    
`,
create : function(scene) {
    let shaderName = "cloud";
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