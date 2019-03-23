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
uniform sampler2D noiseTextureSampler;
uniform float iTime;
uniform mat4 world;
uniform mat4 worldView;
uniform vec3 viewPos;
uniform vec3 sunDir;
uniform float cloudscale;
uniform float cloudspeed;

/**** TWEAK *****************************************************************/
#define COVERAGE		.50
#define THICKNESS		50.
#define EXPONENT		1.5
#define ABSORPTION		1.130725
#define BRIGHTNESS 		0.67
#define CLOUD_SCALE     cloudscale

#define WIND			vec3(0, 0, -u_time * cloudspeed)

#define FBM_FREQ		2.76434
//#define NOISE_VALUE
#define NOISE_WORLEY

#define FAKE_LIGHT
#define SUN_DIR			sunDir

#define STEPS			32
/******************************************************************************/

#if defined(GL_ES) || defined(GL_SHADING_LANGUAGE_VERSION)
    #define _in(T) const in T
    #define _inout(T) inout T
    #define _out(T) out T
    #define _begin(type) type (
    #define _end )
    #define _constant(T) const T
#endif

#define PI 3.14159265359
#define u_time iTime

struct ray_t {
	vec3 origin;
	vec3 direction;
};

struct sphere_t {
	vec3 origin;
	float radius;
	int material;
};

struct plane_t {
	vec3 direction;
	float distance;
	int material;
};

struct hit_t {
	float t;
	int material_id;
	vec3 normal;
	vec3 origin;
};

#define max_dist 1e8

_constant(hit_t) no_hit = _begin(hit_t)
	float(max_dist + 1e1), // 'infinite' distance
	-1, // material id
	vec3(0., 0., 0.), // normal
	vec3(0., 0., 0.) // origin
_end;

_constant(sphere_t) atmosphere = _begin(sphere_t)
	vec3(0, 0, 0), 10000., 0
_end;
_constant(plane_t) ground = _begin(plane_t)
	vec3(0., -1., 0.), -500., 1
_end;


// ----------------------------------------------------------------------------
// Analytical surface-ray intersection routines
// ----------------------------------------------------------------------------

// geometrical solution
// info: http://www.scratchapixel.com/old/lessons/3d-basic-lessons/lesson-7-intersecting-simple-shapes/ray-sphere-intersection/
void intersect_sphere(
	_in(ray_t) ray,
	_in(sphere_t) sphere,
	_inout(hit_t) hit
){
	vec3 rc = sphere.origin - ray.origin;
	float radius2 = sphere.radius * sphere.radius;
	float tca = dot(rc, ray.direction);
//	if (tca < 0.) return;

	float d2 = dot(rc, rc) - tca * tca;
	if (d2 > radius2)
		return;

	float thc = sqrt(radius2 - d2);
	float t0 = tca - thc;
	float t1 = tca + thc;

	if (t0 < 0.) t0 = t1;
	if (t0 > hit.t)
		return;

	vec3 impact = ray.origin + ray.direction * t0;

	hit.t = t0;
	hit.material_id = sphere.material;
	hit.origin = impact;
	hit.normal = (impact - sphere.origin) / sphere.radius;
}

// Plane is defined by normal N and distance to origin P0 (which is on the plane itself)
// a plane eq is: (P - P0) dot N = 0
// which means that any line on the plane is perpendicular to the plane normal
// a ray eq: P = O + t*D
// substitution and solving for t gives:
// t = ((P0 - O) dot N) / (N dot D)
void intersect_plane(
	_in(ray_t) ray,
	_in(plane_t) p,
	_inout(hit_t) hit
){
	float denom = dot(p.direction, ray.direction);
	if (denom < 1e-6) return;

	vec3 P0 = vec3(p.distance, p.distance, p.distance);
	float t = dot(P0 - ray.origin, p.direction) / denom;
	if (t < 0. || t > hit.t) return;
	
	hit.t = t;
	hit.material_id = p.material;
	hit.origin = ray.origin + ray.direction * t;
	hit.normal = faceforward(p.direction, ray.direction, p.direction);
}

// ----------------------------------------------------------------------------
// Noise function by iq from https://www.shadertoy.com/view/ldl3Dl
// ----------------------------------------------------------------------------

vec3 hash_w(
	_in(vec3) x
){
#if 0
	vec3 xx = vec3(dot(x, vec3(127.1, 311.7, 74.7)),
		dot(x, vec3(269.5, 183.3, 246.1)),
		dot(x, vec3(113.5, 271.9, 124.6)));

	return fract(sin(xx)*43758.5453123);
#else
	return texture2D(noiseTextureSampler, (x.xy + vec2(3.0, 1.0)*x.z + 0.5) / 256.0, -100.0).xyz;
#endif
}

// returns closest, second closest, and cell id
vec3 noise_w(
	_in(vec3) x
){
	vec3 p = floor(x);
	vec3 f = fract(x);

	float id = 0.0;
	vec2 res = vec2(100.0, 100.0);
	for (int k = -1; k <= 1; k++)
		for (int j = -1; j <= 1; j++)
			for (int i = -1; i <= 1; i++)
			{
				vec3 b = vec3(float(i), float(j), float(k));
				vec3 r = vec3(b) - f + hash_w(p + b);
				float d = dot(r, r);

				if (d < res.x)
				{
					id = dot(p + b, vec3(1.0, 57.0, 113.0));
					res = vec2(d, res.x);
				}
				else if (d < res.y)
				{
					res.y = d;
				}
			}

	return vec3(sqrt(res), abs(id));
}

#define noise(x) (1. - noise_w(x).r)

// ----------------------------------------------------------------------------
// Fractal Brownian Motion
// ----------------------------------------------------------------------------

float fbm(
	_in(vec3) pos,
	_in(float) lacunarity
){
	vec3 p = pos;
	float
	t  = 0.51749673 * noise(p); p *= lacunarity;
	t += 0.25584929 * noise(p); p *= lacunarity;
	t += 0.12527603 * noise(p); p *= lacunarity;
	t += 0.06255931 * noise(p);
	
	return t;
}

float get_noise(_in(vec3) x)
{
	return fbm(x, FBM_FREQ);
}

// ----------------------------------------------------------------------------
// Clouds
// ----------------------------------------------------------------------------
float density(
	_in(vec3) pos,
	_in(vec3) offset,
	_in(float) t
){
	// signal
	vec3 p = pos * CLOUD_SCALE + offset;
	float dens = get_noise(p);
	
	float cov = 1. - COVERAGE;
	dens *= smoothstep (cov, cov + .05, dens);

	return clamp(dens, 0., 1.);	
}

vec4 render_clouds(
	_in(ray_t) eye
){
	hit_t hit = no_hit;
	intersect_sphere(eye, atmosphere, hit);
	
	const float thickness = THICKNESS;
	const int steps = STEPS;
	float march_step = thickness / float(steps);

	vec3 dir_step = eye.direction / eye.direction.y * march_step;
	vec3 pos = hit.origin;

	float T = 1.; // transmitance
	vec3 C = vec3(0, 0, 0); // color
	float alpha = 0.;

	for (int i = 0; i < steps; i++) {
        
		float h = float(i) / float(steps);
		float dens = density (pos, WIND, h);

		float T_i = exp(-ABSORPTION * dens * march_step);
		T *= T_i;
		if (T < .01) break;

		C += T * 
#ifdef FAKE_LIGHT
			exp(h) *
#endif
			dens * march_step;
		alpha += (1. - T_i) * (1. - alpha);

		pos += dir_step;
	}

    C = clamp(C * BRIGHTNESS, vec3(0.0), vec3(1.0));
    alpha = clamp(alpha, 0.0, 1.0);
	return vec4(C, alpha);
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
vec3 modify_sat(vec3 clr, float sat) {
    vec3 grey = vec3(dot(clr, vec3(0.2126, 0.7152, 0.0722)));
    return mix(grey, clr, sat);    
}

void main(void) {
    vec3 worldPos = (world * vPosition).xyz;
    vec3 viewDir = normalize(worldPos - viewPos);

	ray_t eye_ray = _begin(ray_t)
        viewPos,
        viewDir
    _end;

    vec3 sky = textureCube(skyTextureSampler, viewDir * vec3(1.0, -1.0, 1.0)).xyz;
	vec4 cld = render_clouds(eye_ray);
    
    vec3 col = vec3(0, 0, 0);
    float alpha = 0.0;

    vec3 one = vec3(1.0);
	vec3 skycld = modify_sat(sky, 1.0 + cld.a);
	skycld = skycld * 0.75 * sunDir.y;
	skycld = clamp(skycld, 0.0, 1.0);

	cld.rgb = one - (one - cld.rgb) * (one - skycld);
	col = mix(sky, cld.rgb, cld.a);
	alpha = cld.a * smoothstep(0.0, 0.1, viewDir.y);

	gl_FragColor = vec4(col, alpha);
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