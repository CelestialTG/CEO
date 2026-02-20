// Удаление прелоадера
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    setTimeout(() => {
        preloader.style.opacity = '0';
        setTimeout(() => preloader.remove(), 800);
    }, 1500);
});

// Реальные часы
function updateClock() {
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ":" +
                 now.getMinutes().toString().padStart(2, '0') + ":" +
                 now.getSeconds().toString().padStart(2, '0');
    document.getElementById('clock').innerText = time;
}
setInterval(updateClock, 1000);

// Эффект шума (noise) на Canvas
const canvas = document.getElementById('noise');
const ctx = canvas.getContext('2d');
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function noise() {
    const idata = ctx.createImageData(canvas.width, canvas.height);
    const buffer32 = new Uint32Array(idata.data.buffer);
    for (let i = 0; i < buffer32.length; i++) {
        if (Math.random() < 0.1) buffer32[i] = 0xffffffff;
    }
    ctx.putImageData(idata, 0, 0);
    requestAnimationFrame(noise);
}
noise();

// Плавное появление текста
document.querySelectorAll('.reveal-text').forEach(el => {
    el.style.opacity = "1";
});
