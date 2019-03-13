let shaderCustomSkybox = {
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
uniform mat4 world;
uniform float time;
uniform vec3 sunDir;
uniform float turbidity;

#define PI 3.14159265359

float saturatedDot( in vec3 a, in vec3 b )
{
	return max( dot( a, b ), 0.0 );   
}

vec3 YxyToXYZ( in vec3 Yxy )
{
	float Y = Yxy.r;
	float x = Yxy.g;
	float y = Yxy.b;

	float X = x * ( Y / y );
	float Z = ( 1.0 - x - y ) * ( Y / y );

	return vec3(X,Y,Z);
}

vec3 XYZToRGB( in vec3 XYZ )
{
	// CIE/E
	mat3 M = mat3
	(
		 2.3706743, -0.9000405, -0.4706338,
		-0.5138850,  1.4253036,  0.0885814,
 		 0.0052982, -0.0146949,  1.0093968
	);

	return XYZ * M;
}

vec3 YxyToRGB( in vec3 Yxy )
{
	vec3 XYZ = YxyToXYZ( Yxy );
	vec3 RGB = XYZToRGB( XYZ );
	return RGB;
}

void calculatePerezDistribution( in float t, out vec3 A, out vec3 B, out vec3 C, out vec3 D, out vec3 E )
{
	A = vec3(  0.1787 * t - 1.4630, -0.0193 * t - 0.2592, -0.0167 * t - 0.2608 );
	B = vec3( -0.3554 * t + 0.4275, -0.0665 * t + 0.0008, -0.0950 * t + 0.0092 );
	C = vec3( -0.0227 * t + 5.3251, -0.0004 * t + 0.2125, -0.0079 * t + 0.2102 );
	D = vec3(  0.1206 * t - 2.5771, -0.0641 * t - 0.8989, -0.0441 * t - 1.6537 );
	E = vec3( -0.0670 * t + 0.3703, -0.0033 * t + 0.0452, -0.0109 * t + 0.0529 );
}

vec3 calculateZenithLuminanceYxy( in float t, in float thetaS )
{
	float chi  	 	= ( 4.0 / 9.0 - t / 120.0 ) * ( PI - 2.0 * thetaS );
	float Yz   	 	= ( 4.0453 * t - 4.9710 ) * tan( chi ) - 0.2155 * t + 2.4192;

	float theta2 	= thetaS * thetaS;
    float theta3 	= theta2 * thetaS;
    float T 	 	= t;
    float T2 	 	= t * t;

	float xz =
      ( 0.00165 * theta3 - 0.00375 * theta2 + 0.00209 * thetaS + 0.0)     * T2 +
      (-0.02903 * theta3 + 0.06377 * theta2 - 0.03202 * thetaS + 0.00394) * T +
      ( 0.11693 * theta3 - 0.21196 * theta2 + 0.06052 * thetaS + 0.25886);

    float yz =
      ( 0.00275 * theta3 - 0.00610 * theta2 + 0.00317 * thetaS + 0.0)     * T2 +
      (-0.04214 * theta3 + 0.08970 * theta2 - 0.04153 * thetaS + 0.00516) * T +
      ( 0.15346 * theta3 - 0.26756 * theta2 + 0.06670 * thetaS + 0.26688);

	return vec3( Yz, xz, yz );
}

vec3 calculatePerezLuminanceYxy( in float theta, in float gamma, in vec3 A, in vec3 B, in vec3 C, in vec3 D, in vec3 E )
{
	return ( 1.0 + A * exp( B / cos( theta ) ) ) * ( 1.0 + C * exp( D * gamma ) + E * cos( gamma ) * cos( gamma ) );
}

vec3 calculateSkyLuminanceRGB( in vec3 s, in vec3 e, in float t )
{
	vec3 A, B, C, D, E;
	calculatePerezDistribution( t, A, B, C, D, E );

	float thetaS = acos( saturatedDot( s, vec3(0,1,0) ) );
	float thetaE = acos( saturatedDot( e, vec3(0,1,0) ) );
	float gammaE = acos( saturatedDot( s, e )		   );

	vec3 Yz = calculateZenithLuminanceYxy( t, thetaS );

	vec3 fThetaGamma = calculatePerezLuminanceYxy( thetaE, gammaE, A, B, C, D, E );
	vec3 fZeroThetaS = calculatePerezLuminanceYxy( 0.0,    thetaS, A, B, C, D, E );

	vec3 Yp = Yz * ( fThetaGamma / fZeroThetaS );

	return YxyToRGB( Yp );
}


float Tonemap_Uchimura(float x, float P, float a, float m, float l, float c, float b) {
    // Uchimura 2017, "HDR theory and practice"
    // Math: https://www.desmos.com/calculator/gslcdxvipg
    // Source: https://www.slideshare.net/nikuque/hdr-theory-and-practicce-jp
    float l0 = ((P - m) * l) / a;
    float L0 = m - m / a;
    float L1 = m + (1.0 - m) / a;
    float S0 = m + l0;
    float S1 = m + a * l0;
    float C2 = (a * P) / (P - S1);
    float CP = -C2 / P;

    float w0 = 1.0 - smoothstep(0.0, m, x);
    float w2 = step(m + l0, x);
    float w1 = 1.0 - w0 - w2;

    float T = m * pow(x / m, c) + b;
    float S = P - (P - S1) * exp(CP * (x - S0));
    float L = m + a * (x - m);

    return T * w0 + L * w1 + S * w2;
}

uniform vec4 tonemapping0;
uniform vec4 tonemapping1;

float Tonemap_Uchimura(float x) {
	float P = tonemapping0.x; // max display brightness
    float a = tonemapping0.y; // contrast
    float m = tonemapping0.z; // linear section start
    float l = tonemapping0.w; // linear section length
    float c = tonemapping1.x; // black
    float b = tonemapping1.y; // pedestal

    float mapped = Tonemap_Uchimura(x, P, a, m, l, c, b);

	P = 1.0;  // max display brightness
    a = 1.0;  // contrast
    m = 0.22; // linear section start
    l = 0.4;  // linear section length
    c = 1.33; // black
    b = 0.0;  // pedestal

	return Tonemap_Uchimura((2.0 * mapped) / tonemapping0.x, P, a, m, l, c, b);
}


void main(void) {

    vec3 viewDir  		= normalize( vec3( world * vPosition ) );
    vec3 skyLuminance 	= calculateSkyLuminanceRGB( sunDir, viewDir, turbidity );
    
	skyLuminance.x		= Tonemap_Uchimura(skyLuminance.x);
	skyLuminance.y		= Tonemap_Uchimura(skyLuminance.y);
	skyLuminance.z		= Tonemap_Uchimura(skyLuminance.z);
	gl_FragColor 		= vec4( skyLuminance, 1.0 );
}    
`,
create : function(scene) {
    let shaderName = "customSkybox";
    BABYLON.Effect.ShadersStore[shaderName + "VertexShader"] = this.VS;
    BABYLON.Effect.ShadersStore[shaderName + "FragmentShader"] = this.FS;
    
    let mtl = new BABYLON.ShaderMaterial(shaderName, scene, {
        vertexElement: shaderName,
        fragmentElement: shaderName,
    },
    {
        attributes: ["position", "normal", "uv"],
        uniforms: ["world", "worldView", "worldViewProjection", "view", "projection", "time", "turbidity", "tonemapping0", "tonemapping1" ],
    });
    mtl.backFaceCulling = false;
    return mtl;
}
};