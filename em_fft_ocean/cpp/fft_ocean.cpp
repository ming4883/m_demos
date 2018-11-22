#include <stdlib.h>
#include <stdint.h>
#include <stdio.h>

#define GB_MATH_IMPLEMENTATION
#include "gb_math.h"

#define LODEPNG_IMPLEMENTATION
#include "lodepng.h"

#include "base64.h"

typedef float gbScalar;

struct complex 
{
    gbScalar a, b;

    complex();
    complex(gbScalar a, gbScalar b);
    complex conj();
    complex operator*(const complex& c) const;
    complex operator+(const complex& c) const;
    complex operator-(const complex& c) const;
    complex operator*(const gbScalar c) const;
    complex& operator=(const complex& c);
};

complex::complex() : a(0.0f), b(0.0f) { }
complex::complex(float a, float b) : a(a), b(b) { }
complex complex::conj() { return complex(this->a, -this->b); }

complex complex::operator*(const complex& c) const {
	return complex(this->a*c.a - this->b*c.b, this->a*c.b + this->b*c.a);
}

complex complex::operator+(const complex& c) const {
	return complex(this->a + c.a, this->b + c.b);
}

complex complex::operator-(const complex& c) const {
	return complex(this->a - c.a, this->b - c.b);
}

complex complex::operator*(const float c) const {
	return complex(this->a*c, this->b*c);
}

complex& complex::operator=(const complex& c) {
	this->a = c.a; this->b = c.b;
	return *this;
}

class cFFT {
  private:
	unsigned int N, which;
	unsigned int log_2_N;
	float pi2;
	unsigned int *reversed;
	complex **W;
	complex *c[2];
  protected:
  public:
	cFFT(unsigned int N);
	~cFFT();
	unsigned int reverse(unsigned int i);
	complex w(unsigned int x, unsigned int N);
	void fft(complex* input, complex* output, int stride, int offset);
};

cFFT::cFFT(unsigned int N) : N(N), reversed(0), W(0), pi2(2 * M_PI) {
	c[0] = c[1] = 0;

	log_2_N = log(N)/log(2);

	reversed = new unsigned int[N];		// prep bit reversals
	for (int i = 0; i < N; i++) reversed[i] = reverse(i);

	int pow2 = 1;
	W = new complex*[log_2_N];		// prep W
	for (int i = 0; i < log_2_N; i++) {
		W[i] = new complex[pow2];
		for (int j = 0; j < pow2; j++) W[i][j] = w(j, pow2 * 2);
		pow2 *= 2;
	}

	c[0] = new complex[N];
	c[1] = new complex[N];
	which = 0;
}

cFFT::~cFFT() {
	if (c[0]) delete [] c[0];
	if (c[1]) delete [] c[1];
	if (W) {
		for (int i = 0; i < log_2_N; i++) if (W[i]) delete [] W[i];
		delete [] W;
	}
	if (reversed) delete [] reversed;
}

unsigned int cFFT::reverse(unsigned int i) {
	unsigned int res = 0;
	for (int j = 0; j < log_2_N; j++) {
		res = (res << 1) + (i & 1);
		i >>= 1;
	}
	return res;
}

complex cFFT::w(unsigned int x, unsigned int N) {
	return complex(cos(pi2 * x / N), sin(pi2 * x / N));
}

void cFFT::fft(complex* input, complex* output, int stride, int offset) {
	for (int i = 0; i < N; i++) c[which][i] = input[reversed[i] * stride + offset];

	int loops       = N>>1;
	int size        = 1<<1;
	int size_over_2 = 1;
	int w_          = 0;
	for (int i = 1; i <= log_2_N; i++) {
		which ^= 1;
		for (int j = 0; j < loops; j++) {
			for (int k = 0; k < size_over_2; k++) {
				c[which][size * j + k] =  c[which^1][size * j + k] +
							  c[which^1][size * j + size_over_2 + k] * W[w_][k];
			}

			for (int k = size_over_2; k < size; k++) {
				c[which][size * j + k] =  c[which^1][size * j - size_over_2 + k] -
							  c[which^1][size * j + k] * W[w_][k - size_over_2];
			}
		}
		loops       >>= 1;
		size        <<= 1;
		size_over_2 <<= 1;
		w_++;
	}

	for (int i = 0; i < N; i++) output[i * stride + offset] = c[which][i];
}

const gbScalar G = 9.81f;
const gbScalar A = 0.0005f;
const gbVec2 W {0, 32.0f};

inline gbVec2 unit(gbVec2 v) {
    gbVec2 n;
    gb_vec2_norm(&n, v);
    return n;
}

inline gbScalar uniformRandomVariable() {
	return (gbScalar)rand()/RAND_MAX;
}

inline complex gaussianRandomVariable() {
	gbScalar x1, x2, w;
	do {
	    x1 = 2.f * uniformRandomVariable() - 1.f;
	    x2 = 2.f * uniformRandomVariable() - 1.f;
	    w = x1 * x1 + x2 * x2;
	} while ( w >= 1.f );
	w = gb_sqrt((-2.f * gb_log(w)) / w);
	return complex(x1 * w, x2 * w);
}

// reference https://www.keithlantz.net/2011/10/ocean-simulation-part-one-using-the-discrete-fourier-transform/
struct FFTOcean
{
    struct Vertex
    {
        gbScalar  a,  b,  c; // htilde0
        gbScalar _a, _b, _c; // htilde0mk conjugate
        gbScalar y;
        gbScalar dx, dz;
    };

    int N;
    gbScalar length;
    gbScalar gravity;
    gbScalar amputlide;
    gbVec2 wind;
    Vertex* vertices;
    // fast fourier transform stuff
    complex *h_tilde, *h_tilde_slopex, *h_tilde_slopez, *h_tilde_dx, *h_tilde_dz;
    cFFT *cfft;

    std::string base64;
    
    gbScalar dispersion(int n_prime, int m_prime) {
        gbScalar w_0 = 2.0f * GB_MATH_PI / 200.0f;
        gbScalar kx = GB_MATH_PI * (2 * n_prime - N) / length;
        gbScalar kz = GB_MATH_PI * (2 * m_prime - N) / length;
        return gb_floor(gb_sqrt(gravity * gb_sqrt(kx * kx + kz * kz)) / w_0) * w_0;
    }

    gbScalar phillips(int n_prime, int m_prime) {
        gbVec2 k = gb_vec2(GB_MATH_PI * (2 * n_prime - N) / length,
            GB_MATH_PI * (2 * m_prime - N) / length);
        gbScalar k_length  = gb_vec2_mag(k);
        if (k_length < 0.000001) return 0.0;

        gbScalar k_length2 = k_length  * k_length;
        gbScalar k_length4 = k_length2 * k_length2;

        gbScalar k_dot_w   = gb_vec2_dot(unit(k), unit(wind));
        gbScalar k_dot_w2  = k_dot_w * k_dot_w;

        gbScalar w_length  = gb_vec2_mag(wind);
        gbScalar L         = w_length * w_length / gravity;
        gbScalar L2        = L * L;
        
        gbScalar damping   = 0.001;
        gbScalar l2        = L2 * damping * damping;

        return amputlide * gb_exp(-1.0f / (k_length2 * L2)) / k_length4 * k_dot_w2 * gb_exp(-k_length2 * l2);
    }

    complex hTilde_0(int n_prime, int m_prime) {
        complex r = gaussianRandomVariable();
        return r * gb_sqrt(phillips(n_prime, m_prime) / 2.0f);
    }

    complex hTilde(gbScalar t, int n_prime, int m_prime) {
        const int Nplus1 = N + 1;
        int index = m_prime * Nplus1 + n_prime;

        complex htilde0(vertices[index].a,  vertices[index].b);
        complex htilde0mkconj(vertices[index]._a, vertices[index]._b);

        gbScalar omegat = dispersion(n_prime, m_prime) * t;

        gbScalar cos_ = cos(omegat);
        gbScalar sin_ = sin(omegat);

        complex c0(cos_,  sin_);
        complex c1(cos_, -sin_);

        complex res = htilde0 * c0 + htilde0mkconj * c1;

        return htilde0 * c0 + htilde0mkconj*c1;
    }

    void create() {
        const int Nplus1 = N + 1;

        h_tilde        = new complex[N * N];
        h_tilde_slopex = new complex[N * N];
        h_tilde_slopez = new complex[N * N];
        h_tilde_dx     = new complex[N * N];
        h_tilde_dz     = new complex[N * N];
        vertices       = new Vertex[Nplus1 * Nplus1];

        cfft           = new cFFT(N);

        int index;

        complex htilde0, htilde0mk_conj;
        for (int m_prime = 0; m_prime < Nplus1; m_prime++) {
            for (int n_prime = 0; n_prime < Nplus1; n_prime++) {
                index = m_prime * Nplus1 + n_prime;

                htilde0        = hTilde_0( n_prime,  m_prime);
                htilde0mk_conj = hTilde_0(-n_prime, -m_prime).conj();

                vertices[index].a  = htilde0.a;
                vertices[index].b  = htilde0.b;
                vertices[index]._a = htilde0mk_conj.a;
                vertices[index]._b = htilde0mk_conj.b;
            }
        }
    }

    void destroy() {
        delete[] h_tilde;
        delete[] h_tilde_slopex;
        delete[] h_tilde_slopez;
        delete[] h_tilde_dx;
        delete[] h_tilde_dz;
        delete[] vertices;
        delete cfft;
    }

    void evaluateSpectrum(float t, uint8_t* destBuffer) {
        const int Nplus1 = N + 1;

        gbScalar kx, kz, len, lambda = -1.0f;
        int index, index1;

        for (int m_prime = 0; m_prime < N; m_prime++) {
            kz = M_PI * (2.0f * m_prime - N) / length;
            for (int n_prime = 0; n_prime < N; n_prime++) {
                kx = M_PI * (2.0f * n_prime - N) / length;
                len = gb_sqrt(kx * kx + kz * kz);
                index = m_prime * N + n_prime;

                h_tilde[index] = hTilde(t, n_prime, m_prime);
                h_tilde_slopex[index] = h_tilde[index] * complex(0, kx);
                h_tilde_slopez[index] = h_tilde[index] * complex(0, kz);
                if (len < 0.000001f) {
                    h_tilde_dx[index]     = complex(0.0f, 0.0f);
                    h_tilde_dz[index]     = complex(0.0f, 0.0f);
                } else {
                    h_tilde_dx[index]     = h_tilde[index] * complex(0, -kx/len);
                    h_tilde_dz[index]     = h_tilde[index] * complex(0, -kz/len);
                }
            }
        }

        #if 1
        // perform FFT
        for (int m_prime = 0; m_prime < N; m_prime++) {
            fft(h_tilde, h_tilde, 1, m_prime * N);
            fft(h_tilde_slopex, h_tilde_slopex, 1, m_prime * N);
            fft(h_tilde_slopez, h_tilde_slopez, 1, m_prime * N);
            fft(h_tilde_dx, h_tilde_dx, 1, m_prime * N);
            fft(h_tilde_dz, h_tilde_dz, 1, m_prime * N);
        }
        for (int n_prime = 0; n_prime < N; n_prime++) {
            fft(h_tilde, h_tilde, N, n_prime);
            fft(h_tilde_slopex, h_tilde_slopex, N, n_prime);
            fft(h_tilde_slopez, h_tilde_slopez, N, n_prime);
            fft(h_tilde_dx, h_tilde_dx, N, n_prime);
            fft(h_tilde_dz, h_tilde_dz, N, n_prime);
        }

        int sign;
        float signs[] = { 1.0f, -1.0f };
        //vector3 n;
        for (int m_prime = 0; m_prime < N; m_prime++) {
            for (int n_prime = 0; n_prime < N; n_prime++) {
                index  = m_prime * N + n_prime;		// index into h_tilde..
                index1 = m_prime * Nplus1 + n_prime;	// index into vertices

                sign = signs[(n_prime + m_prime) & 1];

                h_tilde[index]     = h_tilde[index] * sign;

                // height
                vertices[index1].y = h_tilde[index].a;

                // displacement
                h_tilde_dx[index] = h_tilde_dx[index] * sign;
                h_tilde_dz[index] = h_tilde_dz[index] * sign;
                vertices[index1].dx = h_tilde_dx[index].a * lambda;
                vertices[index1].dz = h_tilde_dz[index].a * lambda;
                
                // normal
                h_tilde_slopex[index] = h_tilde_slopex[index] * sign;
                h_tilde_slopez[index] = h_tilde_slopez[index] * sign;
                //n = vector3(0.0f - h_tilde_slopex[index].a, 1.0f, 0.0f - h_tilde_slopez[index].a).unit();
                //vertices[index1].nx =  n.x;
                //vertices[index1].ny =  n.y;
                //vertices[index1].nz =  n.z;

                // for tiling
                if (n_prime == 0 && m_prime == 0) {
                    vertices[index1 + N + Nplus1 * N].y = h_tilde[index].a;

                    vertices[index1 + N + Nplus1 * N].dx = h_tilde_dx[index].a * lambda;
                    vertices[index1 + N + Nplus1 * N].dz = h_tilde_dz[index].a * lambda;
                
                    //vertices[index1 + N + Nplus1 * N].nx =  n.x;
                    //vertices[index1 + N + Nplus1 * N].ny =  n.y;
                    //vertices[index1 + N + Nplus1 * N].nz =  n.z;
                }
                if (n_prime == 0) {
                    vertices[index1 + N].y = h_tilde[index].a;

                    vertices[index1 + N].dx = h_tilde_dx[index].a * lambda;
                    vertices[index1 + N].dz = h_tilde_dz[index].a * lambda;
                
                    //vertices[index1 + N].nx =  n.x;
                    //vertices[index1 + N].ny =  n.y;
                    //vertices[index1 + N].nz =  n.z;
                }
                if (m_prime == 0) {
                    vertices[index1 + Nplus1 * N].y = h_tilde[index].a;

                    vertices[index1 + Nplus1 * N].dx = h_tilde_dx[index].a * lambda;
                    vertices[index1 + Nplus1 * N].dz = h_tilde_dz[index].a * lambda;
                
                    //vertices[index1 + Nplus1 * N].nx =  n.x;
                    //vertices[index1 + Nplus1 * N].ny =  n.y;
                    //vertices[index1 + Nplus1 * N].nz =  n.z;
                }
            }
        }
        #endif

        if (nullptr != destBuffer) {
            //printf("copying...\n");
            gbScalar* out = (float*)destBuffer;

            for(uint32_t y = 0; y < N; ++y) {
                for(uint32_t x = 0; x < N; ++x) {
                    uint32_t index = (x + y * N) * 4;
                    uint32_t index1 = x + y * Nplus1;
                    out[index] = vertices[index1].y;
                    out[index + 1] = vertices[index1].dx;
                    out[index + 2] = vertices[index1].dz;
                    out[index + 3] = 0;
                }
            }
        }
    } // evaluate

    void fft(complex* input, complex* output, int stride, int offset) {
        cfft->fft(input, output, stride, offset);
    }
};

extern "C" uint32_t fft_ocean_create(uint32_t N) {
    auto ocean = new FFTOcean();
    ocean->N = N;
    ocean->wind = W;
    ocean->length = (float)N;
    ocean->gravity = G;
    ocean->amputlide = A;
    ocean->create();

    return reinterpret_cast<uint32_t>(ocean);
}

extern "C" void fft_ocean_destroy(uint32_t handle) {
    //printf("destroying ocean %d\n", handle);
    auto ocean = reinterpret_cast<FFTOcean*>(handle);
    ocean->destroy();
    delete ocean;
}


extern "C" void fft_ocean_evaluate(uint32_t handle, float time, uint8_t* destBuffer) {
    auto ocean = reinterpret_cast<FFTOcean*>(handle);
    ocean->evaluateSpectrum(time, destBuffer);
}

extern "C" const char* fft_ocean_get_png(uint32_t handle, float time) {

    auto ocean = reinterpret_cast<FFTOcean*>(handle);

    const int Nplus1 = ocean->N + 1;
    const int Nover2 = ocean->N / 2;

    ocean->evaluateSpectrum(time, nullptr);
    uint8_t* image = new uint8_t[Nplus1 * Nplus1 * 3];

    auto t = (uint8_t)time;
    
    for(uint32_t y = 0; y < Nplus1; ++y) {
        for(uint32_t x = 0; x < Nplus1; ++x) {
            uint32_t i = x + y * Nplus1;
            auto f = gb_clamp(127 + ocean->vertices[i].y * 4.0f, 0.0f, 255.0f);

            image[i*3 + 0] = (uint8_t)f;
            image[i*3 + 1] = (uint8_t)0;
            image[i*3 + 2] = (uint8_t)0;
        }
    }
    
    uint8_t* png;
    size_t pngsz;
    auto error = lodepng_encode24(&png, &pngsz, image, Nplus1, Nplus1);

    delete[] image;

    ocean->base64 = Base64::Encode(std::string((const char*)png, 
    pngsz));

    ::free(png);
    return ocean->base64.c_str();
}