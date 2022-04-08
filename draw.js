const WIDTH = 2560
const HEIGHT = 1440

const {makeNoise2D} = require("open-simplex-noise")
const noise = makeNoise2D(6666)
const fs = require('fs')
const {createCanvas, createImageData} = require('canvas')
const gl = require('gl')(WIDTH, HEIGHT, {preserveDrawingBuffer: true})

const canvas = createCanvas(WIDTH, HEIGHT)
const ctx = canvas.getContext('2d')
const program = gl.createProgram()

let globaltime = new Date().getTime() * -1
let taskTime = 0

const vertSrc = fs.readFileSync('./shader.vert.hlsl')
const fragSrc = fs.readFileSync('./shader.frag.hlsl')

process.stdout.write("Compiling shaders... ")
taskTime = new Date().getTime() * -1
const vertShader = compShader(gl, gl.VERTEX_SHADER, vertSrc)
const fragShader = compShader(gl, gl.FRAGMENT_SHADER, fragSrc)
taskTime += new Date().getTime()
process.stdout.write(`${taskTime}ms\n`)

gl.attachShader(program, vertShader)
gl.attachShader(program, fragShader)

process.stdout.write("Linking program... ")
taskTime = new Date().getTime() * -1
gl.linkProgram(program)
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const programLog = gl.getProgramInfoLog(program)
    console.error('Unable to initialize the shader program:\n' + programLog)
    process.exitCode = 1
}
taskTime += new Date().getTime()
process.stdout.write(`${taskTime}ms\n`)

let posLoc = gl.getAttribLocation(program, "a_pos")
let buffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
        -1.0, -1.0,
        1.0, -1.0,
        -1.0, 1.0,
        -1.0, 1.0,
        1.0, -1.0,
        1.0,  1.0]),
    gl.STATIC_DRAW
)
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
gl.enableVertexAttribArray(posLoc)
gl.useProgram(program)

gl.uniform1f(gl.getUniformLocation(program, "width"), WIDTH)
gl.uniform1f(gl.getUniformLocation(program, "height"), HEIGHT)
gl.uniform1f(gl.getUniformLocation(program, "ar"), WIDTH / HEIGHT)

let vars = {
    aaLevel: 1,
    rotation: -0.52,
    c: [-0.1, -0.5, -0.2, 0.0],
    camPos: [0, -5, -2]
}

const frames = 1200
for (let i = 1; i <= frames; i++) {
    process.stdout.write(`Frame ${i}/${frames}\n`)
    updateVars(5.5 + i/frames*5.3)
    updateUniforms()

    process.stdout.write('  Drawing and reading pixels... ')
    taskTime = new Date().getTime() * -1
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    const pixels = new Uint8Array(WIDTH * HEIGHT * 4)
    gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    taskTime += new Date().getTime()
    process.stdout.write(`${taskTime}ms\n`)

    process.stdout.write('  Copying image data... ')
    taskTime = new Date().getTime() * -1
    const myData = createImageData(new Uint8ClampedArray(WIDTH*HEIGHT*4), WIDTH)
    for (let i = 0; i < myData.data.length; i++)
        myData.data[i] = pixels[i]
    ctx.putImageData(myData, 0, 0)
    taskTime += new Date().getTime()
    process.stdout.write(`${taskTime}ms\n`)

    process.stdout.write('  Saving... ')
    taskTime = new Date().getTime() * -1
    const imageBuffer = canvas.toBuffer('image/png')
    const filename = String(i).padStart(4, '0');
    fs.writeFileSync('F:/Janek/Renders/node julia/'+filename+'.png', imageBuffer)
    taskTime += new Date().getTime()
    process.stdout.write(`${taskTime}ms\n`)
}

globaltime += new Date().getTime()
process.stdout.write(`Finished in ${formatMillis(globaltime)} `)
let spf = globaltime/frames
if (spf < 1000) {
    let fps = Number(1000/spf).toFixed(3)
    process.stdout.write(`with an average of ${fps}fps\n`)
} else {
    spf = formatMillis(spf)
    process.stdout.write(`with an average of ${spf}pf\n`)
}



















function compShader(gl, type, source) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const shaderLog = gl.getShaderInfoLog(shader)
        console.error('An error occurred compiling the shaders:\n'+shaderLog)
        gl.deleteShader(shader)
        throw 'Fatal error'
    }
    return shader
}

function updateVars(time) {
    // Regular julia
    // let angle = noise(10, time)
    // angle = Math.PI + Math.sqrt(Math.abs(angle)) * (angle < 0 ? -1 : 1);
    // vars.c[0] = Math.cos(angle) * (1 - Math.cos(angle)) * 0.5 + 0.25
    // let rad = Math.sin(angle) * (1 - Math.cos(angle)) * 0.5
    // angle = (noise(20, time) + 1) * Math.PI
    // vars.c[1] = Math.cos(angle) * rad
    // vars.c[2] = Math.sin(angle) * rad
    // angle = ((noise(30, time*0.5)*0.5 + 0.5))**2 * Math.PI
    // rad = Math.sin(angle)
    // vars.c[3] = rad;
    // vars.c[1] *= rad
    // vars.c[2] *= rad

    // Burning Ship Julia
    vars.c[0] = noise(10, time)*0.33 - 0.5
    vars.c[1] = noise(20, time)*0.75 - 0.5
    vars.c[2] = noise(30, time)*0.5 - 0.5
    vars.c[3] = noise(40, time*0.5)*0.5
}

function updateUniforms() {
    let yaw = Math.atan(Math.sqrt(vars.camPos[0]**2 + vars.camPos[1]**2)/vars.camPos[2]);
    yaw = yaw < 0 ? yaw + Math.PI : yaw;
    const pitch = Math.atan2(vars.camPos[1], vars.camPos[0]) + Math.PI*0.5;
    
    gl.uniform1i(gl.getUniformLocation(program, "aaLevel"), vars.aaLevel)
    gl.uniform1f(gl.getUniformLocation(program, "rotation"), vars.rotation)
    gl.uniform4fv(gl.getUniformLocation(program, "c"), vars.c)
    gl.uniform3fv(gl.getUniformLocation(program, "camPos"), vars.camPos)
    gl.uniform1f(gl.getUniformLocation(program, "yaw"), yaw)
    gl.uniform1f(gl.getUniformLocation(program, "pitch"), pitch)
}

function formatMillis(millis) {
        let remainder = millis;
        const days = Math.floor(remainder/86400000);
        remainder -= days * 86400000;
        const hours = Math.floor(remainder/3600000);
        remainder -= hours * 3600000;
        const minutes = Math.floor(remainder/60000);
        remainder -= minutes*60000;
        const seconds = Math.floor(remainder/1000);
        remainder -= seconds*1000;
        const mils = Math.floor(remainder);

        let result = [];
        b = false;
        if (days != 0) {
            result.push(days)
            result.push("d ")
            b = true;
        }
        if (hours != 0 || b) {
            result.push(hours)
            result.push("h ")
            b = true;
        }
        if (minutes != 0 || b) {
            result.push(minutes)
            result.push("m ")
        }
        result.push(seconds)
        result.push(".")
        result.push(String(mils).padStart(3, '0'))
        result.push("s")

        return result.join('');
}


