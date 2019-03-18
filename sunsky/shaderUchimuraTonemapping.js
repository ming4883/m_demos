let shaderUchimuraTonemapping = {
FS : `
#ifdef GL_ES
precision highp float;
#endif

// Samplers
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform float enabled;
uniform float param_P;


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


vec3 Tonemap_Uchimura(vec3 color) {
	
	float P = 1.0;  // max display brightness
	float a = 1.0;  // contrast
    float m = 0.22; // linear section start
    float l = 0.4;  // linear section length
    float c = 1.33; // black
    float b = 0.0;  // pedestal

    //color.xyz /= param_P;

	color.x = Tonemap_Uchimura(color.x, P, a, m, l, c, b);
    color.y = Tonemap_Uchimura(color.y, P, a, m, l, c, b);
    color.z = Tonemap_Uchimura(color.z, P, a, m, l, c, b);
    return color;
}

void main()
{
    vec4 baseColor = texture2D(textureSampler, vUV);

    if (enabled > 0.0)
        baseColor.xyz = Tonemap_Uchimura(baseColor.xyz);
    gl_FragColor = baseColor;
}
`,
createPostProcess: function(camera) {
    BABYLON.Effect.ShadersStore["UchimuraTonemappingFragmentShader"] = this.FS;
    let postProcess = new BABYLON.PostProcess(
        "UchimuraTonemapping", // name
        "UchimuraTonemapping", // fragment url
        ["enabled", "param_P"], // params
        null, // samplers
        1.0, // ratio
        camera, // camera
        0, // samplingMode
        null, // engine
        false, // reusable
        null, // defines
        BABYLON.Engine.TEXTURETYPE_HALF_FLOAT
        );
    return postProcess;
}
};