const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl");
if (!gl) alert("WebGL not supported");

const fileInput = document.getElementById("fileInput");
const focal = document.getElementById("focal");
const aperture = document.getElementById("aperture");
const iso = document.getElementById("iso");
const exposure = document.getElementById("exposure");
const downloadBtn = document.getElementById("downloadTiff");

let imageData = null;

// Vertex Shader
const vertexSrc = `
attribute vec2 a_position;
attribute vec2 a_texcoord;
varying vec2 v_texcoord;
void main(){ gl_Position = vec4(a_position,0,1); v_texcoord = a_texcoord; }
`;

// Fragment Shader
const fragmentSrc = `
precision mediump float;
uniform sampler2D u_image;
uniform float u_focal;
uniform float u_aperture;
uniform float u_iso;
uniform float u_exposure;
varying vec2 v_texcoord;
void main(){
  vec4 color = texture2D(u_image,v_texcoord);
  float factor = (u_aperture*u_aperture)/(u_focal*u_focal)*u_exposure*(u_iso/100.0);
  float brightness = factor/0.02;
  for(int i=0;i<3;i++){
    color[i] = pow((color[i]*brightness)/(1.0 + color[i]*brightness), 1.0/2.2);
  }
  gl_FragColor = vec4(color.rgb,1.0);
}
`;

// Compile shaders
function createShader(gl,type,src){
  const s = gl.createShader(type);
  gl.shaderSource(s,src);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.log(gl.getShaderInfoLog(s));
  return s;
}
function createProgram(gl,v,f){
  const p = gl.createProgram();
  gl.attachShader(p,v);
  gl.attachShader(p,f);
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS))
      console.log(gl.getProgramInfoLog(p));
  return p;
}

const vShader = createShader(gl, gl.VERTEX_SHADER, vertexSrc);
const fShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
const program = createProgram(gl,vShader,fShader);
gl.useProgram(program);

// Fullscreen quad
const posLoc = gl.getAttribLocation(program,"a_position");
const texLoc = gl.getAttribLocation(program,"a_texcoord");
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1,-1, 0,0, 1,-1,1,0, -1,1,0,1,
  -1,1,0,1, 1,-1,1,0, 1,1,1,1
]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc,2,gl.FLOAT,false,16,0);
gl.enableVertexAttribArray(texLoc);
gl.vertexAttribPointer(texLoc,2,gl.FLOAT,false,16,8);

// Uniforms
const u_image = gl.getUniformLocation(program,"u_image");
const u_focal = gl.getUniformLocation(program,"u_focal");
const u_aperture = gl.getUniformLocation(program,"u_aperture");
const u_iso = gl.getUniformLocation(program,"u_iso");
const u_exposure = gl.getUniformLocation(program,"u_exposure");

// Texture
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D,texture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

function draw(){
  if(!imageData) return;
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  gl.viewport(0,0,canvas.width,canvas.height);

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,imageData.width,imageData.height,0,gl.RGBA,gl.UNSIGNED_BYTE,imageData.data);

  gl.uniform1f(u_focal, parseFloat(focal.value));
  gl.uniform1f(u_aperture, parseFloat(aperture.value));
  gl.uniform1f(u_iso, parseFloat(iso.value));
  gl.uniform1f(u_exposure, parseFloat(exposure.value));
  gl.uniform1i(u_image,0);

  gl.drawArrays(gl.TRIANGLES,0,6);
}

// Load TIFF from file input
fileInput.addEventListener("change", e=>{
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = function(){
    const buf = reader.result;
    const ifds = UTIF.decode(buf);         // LZW decompression happens here
    UTIF.decodeImage(buf, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    imageData = { width: ifds[0].width, height: ifds[0].height, data: rgba };
    draw();
  };
  reader.readAsArrayBuffer(file);
});

// Update on float input change
[focal, aperture, iso, exposure].forEach(el=>el.addEventListener("input", draw));

// Download processed TIFF
downloadBtn.addEventListener("click", ()=>{
  if(!imageData) return;
  const ifd = {
    width: imageData.width,
    height: imageData.height,
    data: imageData.data,
    bitsPerSample: [8,8,8,8],
    samplesPerPixel: 4,
    compression: 1,
    photometricInterpretation: 2,
    planarConfiguration: 1
  };
  const tiffArray = UTIF.encodeImage(ifd.data, ifd.width, ifd.height, ifd);
  const blob = new Blob([tiffArray], {type:"image/tiff"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "astro_processed.tiff";
  a.click();
});
