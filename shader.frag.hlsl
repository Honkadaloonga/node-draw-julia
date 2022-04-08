precision highp float;
precision highp int;

varying vec2 i_pos;

// Ray variables
const int maxStepCount = 1024;
const float epsilon = 0.0001;
uniform int aaLevel;

// Julia variables
uniform float rotation;
uniform vec4 c;
const int maxIter = 16;

// Camera variables
uniform float width;
uniform float height;
uniform float ar;

uniform vec3 camPos;
uniform float yaw;
uniform float pitch;

vec4 quatMult(vec4 q1, vec4 q2) {
    vec4 r;
    r.x = q1.x*q2.x - dot(q1.yzw, q2.yzw);
    r.yzw = q1.x*q2.yzw + q2.x*q1.yzw + cross(q1.yzw, q2.yzw);
    return r;
}

vec4 quatSqr(vec4 q) {
    vec4 r;
    r.x = q.x*q.x - dot(q.yzw, q.yzw);
    r.yzw = 2.0*q.x*q.yzw;
    return r;
}

vec3 rotateX(vec3 v, float a) {
    return vec3(v.x, v.y*cos(a) - v.z*sin(a), v.y*sin(a) + v.z*cos(a));
}

vec3 rotateZ(vec3 v, float a) {
    return vec3(v.x*cos(a) - v.y*sin(a), v.x*sin(a) + v.y*cos(a), v.z);
}

float boxDE(vec3 pos, vec3 b) {
    pos.z -= 10.0;
    vec3 q = abs(pos) - b;
    return length(max(q, 0.0)) + min(max(q.x,max(q.y,q.z)), 0.0);
}

vec2 juliaDE(vec3 pos) {
    pos = rotateZ(pos, rotation);
    
    vec4 z = vec4(pos, 0.0);
    z = abs(z);
    vec4 dz = vec4(1.0, 0.0, 0.0, 0.0);

    float m2;
    int k;
    for (int i = 0; i < maxIter; i++) {
        k = i;
        dz = 2.0 * quatMult(z, dz);
        z = quatSqr(z) + c;
        m2 = dot(z, z);
        if (m2 > 1024.0) {
            break;
        }
        z = abs(z);
    }

    m2 = sqrt(m2/dot(dz, dz)) * 0.22 * log(m2);
    return vec2(float(k), m2);
}

vec2 DE(vec3 pos) {
    return juliaDE(pos);
    // vec2 julia = juliaDE(pos);
    // float box = boxDE(pos, vec3(10.0, 10.0, 10.0));
    // vec2 r;
    // if (julia.y > box) {
    //     r = julia;
    // } else {
    //     r = vec2(julia.x, box);
    // }
    // return r;
}

vec3 estimateNormal(vec3 p) {
    float x = DE(vec3(p.x+epsilon, p.y, p.z)).y - DE(vec3(p.x-epsilon, p.y, p.z)).y;
    float y = DE(vec3(p.x, p.y+epsilon, p.z)).y - DE(vec3(p.x, p.y-epsilon, p.z)).y;
    float z = DE(vec3(p.x, p.y, p.z+epsilon)).y - DE(vec3(p.x, p.y, p.z-epsilon)).y;
    return normalize(vec3(x, y, z));
}

float rand(float v) {
    return fract((sin(v * 12.9898) + 1.1) * 4758.5453);
}

float flatten(float x) {
    float p = pow(5.0, -x);
    return (1.0-p)/(1.0+p);
}

vec3 sample(vec2 c) {
    vec3 rayDir = vec3(c * 0.225, -1);
    rayDir.x *= ar;
    rayDir = rotateX(rayDir, yaw);
    rayDir = rotateZ(rayDir, pitch);
    rayDir = normalize(rayDir);

    vec3 rayPos = camPos;
    float rayDst = 0.0;
    int marchSteps = 0;
    float esc = 65.0;
    vec3 result = mix(vec3(0.01, 0.15, 0.25), vec3(0.01, 0.0, 0.2), c.y*0.5 + 0.5);

    for (int i = 0; i < maxStepCount; i++) {
        marchSteps++;
        vec2 de = DE(rayPos);
        float dist = de.y;

        if (dist < epsilon) {
            vec3 normal = estimateNormal(rayPos - rayDir*epsilon*2.0);
            float colorA = 1.0 - clamp(dot(normal*0.5 + 0.5, vec3(0.1, 0.4, 0.8)) - 0.1, 0.0, 1.0);
            float colorB = 3.0 - 2.0*de.x/float(maxIter);
            result = clamp(colorA*vec3(0.1, 0.3, 1.0) + colorB*vec3(0.1, 0.4, 0.8), 0.0, 1.0);
            marchSteps += 20;
            esc = 65.0;
            break;
        }

        rayPos += rayDir * dist;
        rayDst += dist;
        if (rayDst > 100.0) {
            break;
        }
    }

    float rim = flatten(float(marchSteps)/esc);
    result *= rim;
    return result;
}

void main() {
    vec3 result = vec3(0.0, 0.0, 0.0);
    if (aaLevel == 1) {
        result = sample(i_pos);
    } else {
        for (int i = 0; i < 8; i++) {
            if (i == aaLevel) {
                break;
            }
            vec2 uv = i_pos;
            uv = uv * 0.5 + 0.5;
            uv.x *= width;
            uv.y *= height;
            uv += vec2(rand(uv.x + float(i)), rand(uv.y + float(i)));
            uv.x /= width;
            uv.y /= height;
            uv = (uv - 0.5) * 2.0;
            result += sample(uv);
        }
        result /= float(aaLevel);
    }
    gl_FragColor = vec4(result, 1.0);
}