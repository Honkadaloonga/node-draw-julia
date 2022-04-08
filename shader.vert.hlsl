precision highp float;
precision highp int;

attribute vec2 a_pos;
varying vec2 i_pos;

void main() {
    i_pos = a_pos;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}