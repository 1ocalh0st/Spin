(() => {
    const colors = ["#a78bfa", "#5eead4", "#fdba74", "#f472b6", "#60a5fa", "#ffffff"];

    function createConfetti() {
        const canvas = document.createElement("canvas");
        canvas.style.position = "fixed";
        canvas.style.inset = "0";
        canvas.style.pointerEvents = "none";
        canvas.style.zIndex = "9999";
        document.body.appendChild(canvas);

        const ctx = canvas.getContext("2d");
        let width = window.innerWidth;
        let height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        const particles = [];
        const count = 150;

        for (let i = 0; i < count; i++) {
            particles.push({
                x: width / 2,
                y: height / 2,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20 - 5,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10,
                opacity: 1,
            });
        }

        let animationId;
        const startTime = Date.now();

        function update() {
            const now = Date.now();
            const dt = (now - startTime) / 1000;

            if (dt > 3) {
                // Fade out
                canvas.style.transition = "opacity 1s";
                canvas.style.opacity = "0";
                setTimeout(() => {
                    cancelAnimationFrame(animationId);
                    if (document.body.contains(canvas)) document.body.removeChild(canvas);
                }, 1000);
                return;
            }

            ctx.clearRect(0, 0, width, height);

            particles.forEach((p) => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.5; // Gravity
                p.rotation += p.rotationSpeed;
                p.vx *= 0.96; // Friction
                p.vy *= 0.96;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            });

            animationId = requestAnimationFrame(update);
        }

        update();

        window.addEventListener(
            "resize",
            () => {
                width = window.innerWidth;
                height = window.innerHeight;
                canvas.width = width;
                canvas.height = height;
            },
            { once: true },
        );
    }

    window.startConfetti = createConfetti;
})();
