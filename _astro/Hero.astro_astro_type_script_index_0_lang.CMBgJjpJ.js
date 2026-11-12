var e=Math.PI*2,t=[5/255,19/255,22/255],n=2.6,r=16,i={pitch:-.6,yaw:-.18,roll:.32},a=.66,o=5.25,s=900,c=12,l=`#version 300 es
precision highp float;
layout(location = 0) in vec2 a_sv; // s along the loop (0..1), v across the band (-1..1)
uniform mat4 u_proj;
uniform mat3 u_pose;
uniform float u_dist;
uniform float u_time;
uniform float u_breath;
uniform float u_drawn;
out vec3 v_p;
out vec3 v_n;
out vec2 v_sv;
const float TAU = 6.28318530718;

// A figure eight (Gerono's lemniscate) whose two strands pass apart in depth at the
// crossing. The lobes swell and settle in turn.
vec3 path(float s) {
  float t = TAU * s;
  float side = cos(t);
  return vec3(1.62 * side * (1.0 + 0.025 * u_breath * side), 0.74 * sin(2.0 * t) * (1.0 + 0.07 * u_breath * side), 0.32 * sin(t));
}

void main() {
  float s = a_sv.x;
  vec3 c = path(s);
  vec3 along = normalize(path(s + 0.0004) - path(s - 0.0004));
  vec3 n0 = normalize(cross(vec3(0.0, 0.0, 1.0), along));
  vec3 b0 = cross(along, n0);
  // The band's tilt, with a slow ripple of twist travelling along it.
  float twist = 0.75 + 0.22 * sin(2.0 * TAU * s - 0.62 * u_time);
  vec3 across = cos(twist) * n0 + sin(twist) * b0;
  float half_width = 0.34 + 0.025 * sin(2.0 * TAU * s + 0.4 * u_time);
  // While the loop is being drawn, both ends of the stroke taper to a point,
  // widening to meet as it closes.
  float from_crossing = fract(s - 0.25);
  float taper = 1.0 - smoothstep(0.82, 1.0, u_drawn);
  half_width *= mix(1.0, smoothstep(0.0, 0.06, from_crossing) * (1.0 - smoothstep(u_drawn - 0.09, u_drawn, from_crossing)), taper);
  vec3 p = u_pose * (c + across * (half_width * a_sv.y));
  p.z -= u_dist;
  v_p = p;
  v_n = u_pose * cross(along, across);
  v_sv = a_sv;
  gl_Position = u_proj * vec4(p, 1.0);
}`,u=`#version 300 es
precision highp float;
in vec3 v_p;
in vec3 v_n;
in vec2 v_sv;
uniform float u_time;
uniform float u_head;  // where the light is, in loops from the crossing
uniform float u_drawn; // how much of the loop is drawn (1: all of it)
uniform vec3 u_light;
uniform float u_gain;
out vec4 o;
const float TAU = 6.28318530718;

void main() {
  vec3 V = normalize(-v_p);
  vec3 N = normalize(v_n);
  float side = dot(N, V);
  N = side < 0.0 ? -N : N;
  float fresnel = pow(clamp(1.0 - abs(side), 0.0, 1.0), 3.0);
  float outer = smoothstep(-0.2, 0.2, side);

  float e = abs(v_sv.y);
  float px = fwidth(v_sv.y);
  float body = 1.0 - smoothstep(1.0 - 1.5 * px, 1.0, e);
  float q = (1.0 - e) / max(0.03, 2.0 * px);
  float lip = exp(-q * q);

  float s = fract(v_sv.x - 0.25); // 0 at the crossing
  float drawn = u_drawn >= 1.0 ? 1.0 : 1.0 - smoothstep(u_drawn - 0.012, u_drawn + 0.002, s);
  float d = fract(s - u_head + 0.5) - 0.5; // + ahead of the light, - behind it
  float light = d >= 0.0 ? exp(-d * d * 2600.0) : (exp(d * 7.0) - exp(-3.5)) / (1.0 - exp(-3.5));

  float wrap = 0.5 + 0.5 * dot(N, u_light);
  float nh = max(dot(N, normalize(u_light + V)), 0.0);
  float sheen = 0.5 + 0.5 * sin(3.0 * TAU * v_sv.x - 0.3 * u_time + 2.2 * e);
  float depth = smoothstep(-8.0, -4.4, v_p.z);

  vec3 deep = vec3(0.0, 0.36, 0.28);
  vec3 mint = vec3(0.17, 0.98, 0.76);
  vec3 ice = vec3(0.86, 1.0, 0.95);
  vec3 col = mix(deep, mint, outer) * (0.08 + 0.3 * wrap * wrap + 0.7 * fresnel + 0.05 * sheen);
  col += mint * pow(nh, 10.0) * 0.45 + ice * pow(nh, 160.0) * 2.4;
  col += ice * lip * (1.1 + 2.0 * fresnel) * mix(0.55, 1.0, outer);
  col += mix(mint, ice, 0.6) * light * (0.7 + 1.5 * lip + 0.8 * fresnel);
  o = vec4(col * body * drawn * (0.5 + 0.5 * depth) * u_gain, 1.0);
}`,d=`#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,f=`#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_size; // of the target
uniform vec2 u_step; // in the source's uv
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / u_size;
  vec3 c = texture(u_src, uv).rgb * 0.227027;
  c += (texture(u_src, uv + u_step * 1.384615).rgb + texture(u_src, uv - u_step * 1.384615).rgb) * 0.316216;
  c += (texture(u_src, uv + u_step * 3.230769).rgb + texture(u_src, uv - u_step * 3.230769).rgb) * 0.070270;
  o = vec4(c, 1.0);
}`,p=`#version 300 es
precision highp float;
uniform sampler2D u_scene;
uniform sampler2D u_near;
uniform sampler2D u_far;
uniform vec2 u_size;
uniform vec3 u_bg;
uniform float u_exposure;
out vec4 o;
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_size;
  vec2 edge = min(uv, 1.0 - uv);
  float fade = smoothstep(0.0, 0.07, min(edge.x, edge.y));
  vec3 hdr = texture(u_scene, uv).rgb + (texture(u_near, uv).rgb * 0.45 + texture(u_far, uv).rgb * 0.8) * fade;
  // Rolled off by its brightest channel, so the mint keeps its colour; only the
  // brightest light goes on to white.
  hdr *= u_exposure;
  float peak = max(max(hdr.r, hdr.g), hdr.b);
  vec3 lit = hdr * ((1.0 - exp(-peak)) / max(peak, 1e-4));
  lit += (1.0 - lit) * smoothstep(1.2, 4.0, peak) * 0.55;
  vec3 col = 1.0 - (1.0 - u_bg) * (1.0 - lit);
  o = vec4(col + (hash(gl_FragCoord.xy) - 0.5) / 255.0, 1.0);
}`;function m(e,t,n){let r=e.createProgram();for(let[i,a]of[[e.VERTEX_SHADER,t],[e.FRAGMENT_SHADER,n]]){let t=e.createShader(i);e.shaderSource(t,a),e.compileShader(t),e.attachShader(r,t),e.deleteShader(t)}return e.linkProgram(r),e.getProgramParameter(r,e.LINK_STATUS)?r:(console.warn(`ribbon:`,e.getProgramInfoLog(r)),null)}function h(e,t,n){let[r,i,a,o,s,c]=[Math.cos(e),Math.sin(e),Math.cos(t),Math.sin(t),Math.cos(n),Math.sin(n)],l=[r,0,-i,0,1,0,i,0,r],u=[1,0,0,0,a,o,0,-o,a],d=[s,c,0,-c,s,0,0,0,1],f=(e,t)=>Array.from({length:9},(n,r)=>{let i=Math.floor(r/3),a=r%3;return e[a]*t[i*3]+e[3+a]*t[i*3+1]+e[6+a]*t[i*3+2]});return new Float32Array(f(d,f(u,l)))}function g(e){let n=m(e,l,u),r=m(e,d,f),i=m(e,d,p);if(!n||!r||!i)return null;let g=(t,n)=>Object.fromEntries(n.map(n=>[n,e.getUniformLocation(t,n)])),_=g(n,[`u_proj`,`u_pose`,`u_dist`,`u_time`,`u_breath`,`u_head`,`u_drawn`,`u_light`,`u_gain`]),v=g(r,[`u_src`,`u_size`,`u_step`]),y=g(i,[`u_scene`,`u_near`,`u_far`,`u_size`,`u_bg`,`u_exposure`]),b=new Float32Array(23426);for(let e=0,t=0;e<=s;e++)for(let n=0;n<=c;n++)b[t++]=e/s,b[t++]=n/c*2-1;let x=new Uint16Array(s*c*6);for(let e=0,t=0;e<s;e++)for(let n=0;n<c;n++){let r=e*13+n,i=r+c+1;x.set([r,i,r+1,r+1,i,i+1],t),t+=6}let S=e.createVertexArray();e.bindVertexArray(S),e.bindBuffer(e.ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ARRAY_BUFFER,b,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ELEMENT_ARRAY_BUFFER,x,e.STATIC_DRAW);let C=e.createVertexArray();e.bindVertexArray(null);let w=!!(e.getExtension(`EXT_color_buffer_float`)||e.getExtension(`EXT_color_buffer_half_float`)),T=(t,n,r)=>{t.w=n,t.h=r,e.bindTexture(e.TEXTURE_2D,t.tex),e.texImage2D(e.TEXTURE_2D,0,w?e.RGBA16F:e.RGBA8,n,r,0,e.RGBA,w?e.HALF_FLOAT:e.UNSIGNED_BYTE,null)},E=()=>{let t=e.createTexture();e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);let n={tex:t,fb:e.createFramebuffer(),w:0,h:0};return T(n,4,4),e.bindFramebuffer(e.FRAMEBUFFER,n.fb),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0),n},D=E(),O=Math.min(4,e.getParameter(e.MAX_SAMPLES)),k={fb:e.createFramebuffer(),rb:e.createRenderbuffer(),w:0,h:0},A=(t,n)=>{k.w=t,k.h=n,e.bindRenderbuffer(e.RENDERBUFFER,k.rb),e.renderbufferStorageMultisample(e.RENDERBUFFER,O,w?e.RGBA16F:e.RGBA8,t,n)};A(4,4),e.bindFramebuffer(e.FRAMEBUFFER,k.fb),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,k.rb);let j=t=>(e.bindFramebuffer(e.FRAMEBUFFER,t),e.checkFramebufferStatus(e.FRAMEBUFFER)===e.FRAMEBUFFER_COMPLETE);w&&!(j(D.fb)&&j(k.fb))&&(w=!1,T(D,4,4),A(4,4));let M=E(),N=E(),P=E(),F=E();e.bindFramebuffer(e.FRAMEBUFFER,null);let I=w?1:.5,L=1,R=1,z=new Float32Array(16);function B(t,r){e.bindFramebuffer(e.FRAMEBUFFER,t.fb),e.viewport(0,0,t.w,t.h),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(n),e.uniformMatrix4fv(_.u_proj,!1,z),e.uniformMatrix3fv(_.u_pose,!1,h(r.yaw,r.pitch,r.roll)),e.uniform1f(_.u_dist,o),e.uniform1f(_.u_time,r.time),e.uniform1f(_.u_breath,r.breath),e.uniform1f(_.u_head,r.head),e.uniform1f(_.u_drawn,r.drawn);let i=[.45+.25*Math.cos(r.glint),.7+.15*Math.sin(r.glint*.7),.55],a=Math.hypot(i[0],i[1],i[2]);e.uniform3f(_.u_light,i[0]/a,i[1]/a,i[2]/a),e.uniform1f(_.u_gain,I),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE),e.bindVertexArray(S),e.drawElements(e.TRIANGLES,x.length,e.UNSIGNED_SHORT,0),e.disable(e.BLEND)}function V(t,n,r,i){e.bindFramebuffer(e.FRAMEBUFFER,n.fb),e.viewport(0,0,n.w,n.h),e.uniform2f(v.u_size,n.w,n.h),e.uniform2f(v.u_step,r/t.w,i/t.h),e.bindTexture(e.TEXTURE_2D,t.tex),e.drawArrays(e.TRIANGLES,0,3)}return{resize(e,t){L=e,R=t;let n=1/Math.tan(a/2);z.set([n/(L/R),0,0,0,0,n,0,0,0,0,40.1/-39.9,-1,0,0,8/-39.9,0]),T(D,L,R),A(L,R);for(let[e,t]of[[M,4],[N,4],[P,8],[F,8]])T(e,Math.max(1,Math.round(L/t)),Math.max(1,Math.round(R/t)))},draw(n){B(M,n),e.useProgram(r),e.uniform1i(v.u_src,0),e.activeTexture(e.TEXTURE0),e.bindVertexArray(C),V(M,N,1,0),V(N,M,0,1),V(M,F,2,0),V(F,P,0,2),V(P,F,2,0),V(F,P,0,2),B(k,n),e.bindFramebuffer(e.READ_FRAMEBUFFER,k.fb),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,D.fb),e.blitFramebuffer(0,0,L,R,0,0,L,R,e.COLOR_BUFFER_BIT,e.NEAREST),e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,L,R),e.useProgram(i),e.uniform1i(y.u_scene,0),e.uniform1i(y.u_near,1),e.uniform1i(y.u_far,2),e.uniform2f(y.u_size,L,R),e.uniform3f(y.u_bg,t[0],t[1],t[2]),e.uniform1f(y.u_exposure,1/I);for(let[t,n]of[[2,P],[1,M],[0,D]])e.activeTexture(e.TEXTURE0+t),e.bindTexture(e.TEXTURE_2D,n.tex);e.bindVertexArray(C),e.drawArrays(e.TRIANGLES,0,3)}}}var _=!1;function v(t,a){let o=t.getContext(`webgl2`,{alpha:!1,antialias:!1,depth:!1,stencil:!1,powerPreference:`low-power`}),s=o&&g(o);if(!o||!s)return a.failed(),()=>{};let c=o.getExtension(`WEBGL_lose_context`),l=matchMedia(`(prefers-reduced-motion: reduce)`),u=matchMedia(`(hover: hover) and (pointer: fine)`),d=l.matches,f=_,p=!0,m=!1,h=0,v=0,y=_?n:0,b={x:0,y:0},x={x:0,y:0},S=null,C=()=>{if(d)return{time:5,head:.58,drawn:1,breath:0,yaw:i.yaw,pitch:i.pitch,roll:i.roll,glint:1.1};let t=Math.min(y/n,1),a=y/r+(1-n/r)*(1-(1-t)**3);return{time:y,head:a,drawn:f?Math.min(a,1):0,breath:Math.sin(e*y/11),yaw:i.yaw+.12*Math.sin(e*y/23)+.16*b.x,pitch:i.pitch+.05*Math.sin(e*y/17+1)+.1*b.y,roll:i.roll+.03*Math.sin(e*y/29),glint:e*y/31}},w=``,T=(e,n)=>{let r=Math.min(devicePixelRatio||1,2),[i,a]=[Math.max(1,Math.round(e*r)),Math.max(1,Math.round(n*r))];w!==`${i}x${a}`&&(w=`${i}x${a}`,t.width=i,t.height=a,s.resize(i,a),s.draw(C()))};T(t.clientWidth,t.clientHeight),t.dataset.drawn=``,a.drawn();let E=()=>!m&&!d&&f&&p&&!document.hidden,D=e=>{if(h=0,!E())return;let r=Math.min((e-v)/1e3,.05);if(v=e,y+=r,y>=n&&(_=!0),S){let e=t.getBoundingClientRect();x={x:Math.max(-1,Math.min(1,(S.x-e.left-e.width/2)/(e.width/2))),y:Math.max(-1,Math.min(1,(S.y-e.top-e.height/2)/(e.height/2)))}}let i=1-Math.exp(-r/1.1);b={x:b.x+(x.x-b.x)*i,y:b.y+(x.y-b.y)*i},s.draw(C()),h=requestAnimationFrame(D)},O=()=>{!h&&E()&&(v=performance.now(),h=requestAnimationFrame(D))};a.begin.then(()=>{f=!0,O()});let k=new IntersectionObserver(e=>{p=e[e.length-1].isIntersecting,O()});k.observe(t);let A=new ResizeObserver(([e])=>T(e.contentRect.width,e.contentRect.height));A.observe(t);let j=()=>O(),M=()=>{d=l.matches,d?s.draw(C()):O()},N=e=>{S=u.matches&&e.pointerType===`mouse`?{x:e.clientX,y:e.clientY}:null,S||(x={x:0,y:0})},P=e=>{e.relatedTarget||(S=null,x={x:0,y:0})},F=e=>{e.preventDefault(),I(),a.failed()};document.addEventListener(`visibilitychange`,j),l.addEventListener(`change`,M),addEventListener(`pointermove`,N,{passive:!0}),document.addEventListener(`pointerout`,P),t.addEventListener(`webglcontextlost`,F);function I(){m||(m=!0,cancelAnimationFrame(h),k.disconnect(),A.disconnect(),document.removeEventListener(`visibilitychange`,j),l.removeEventListener(`change`,M),removeEventListener(`pointermove`,N),document.removeEventListener(`pointerout`,P),t.removeEventListener(`webglcontextlost`,F),t.isConnected||c?.loseContext())}return I}var y=document.querySelector(`.hero .ribbon`),b=y?.querySelector(`canvas`);if(y&&b){let e=()=>{},t=()=>{e(),y.classList.remove(`live`),e=document.documentElement.dataset.theme===`light`?()=>{}:v(b,{drawn:()=>y.classList.add(`live`),failed:()=>{},begin:Promise.resolve()})};new MutationObserver(t).observe(document.documentElement,{attributeFilter:[`data-theme`]}),t()}