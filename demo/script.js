class WaterRippleSimulation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // 水面参数
        this.resolution = 4; // 网格分辨率
        this.cols = Math.floor(this.width / this.resolution);
        this.rows = Math.floor(this.height / this.resolution);
        
        // 水面高度数组
        this.currentHeight = [];
        this.previousHeight = [];
        this.velocity = [];
        
        // 物理参数
        this.damping = 0.95;
        this.waveStrength = 5;
        
        // 鼠标交互
        this.isMouseDown = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // 渲染参数
        this.renderMode = '3d'; // '3d' 或 '2d'
        
        this.initArrays();
        this.setupEventListeners();
        this.animate();
    }
    
    initArrays() {
        for (let i = 0; i < this.cols * this.rows; i++) {
            this.currentHeight[i] = 0;
            this.previousHeight[i] = 0;
            this.velocity[i] = 0;
        }
    }
    
    setupEventListeners() {
        // 鼠标事件
        this.canvas.addEventListener('mousedown', (e) => {
            this.isMouseDown = true;
            const rect = this.canvas.getBoundingClientRect();
            this.lastMouseX = e.clientX - rect.left;
            this.lastMouseY = e.clientY - rect.top;
            this.createRipple(this.lastMouseX, this.lastMouseY);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isMouseDown) {
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                this.createRipple(mouseX, mouseY);
                this.lastMouseX = mouseX;
                this.lastMouseY = mouseY;
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.isMouseDown = false;
        });
        
        // 触摸事件（移动设备支持）
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;
            this.createRipple(touchX, touchY);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;
            this.createRipple(touchX, touchY);
        });
        
        // 控制面板事件
        const dampingSlider = document.getElementById('damping');
        const dampingValue = document.getElementById('dampingValue');
        dampingSlider.addEventListener('input', (e) => {
            this.damping = parseFloat(e.target.value);
            dampingValue.textContent = this.damping;
        });
        
        const waveStrengthSlider = document.getElementById('waveStrength');
        const waveStrengthValue = document.getElementById('waveStrengthValue');
        waveStrengthSlider.addEventListener('input', (e) => {
            this.waveStrength = parseInt(e.target.value);
            waveStrengthValue.textContent = this.waveStrength;
        });
        
        const resetBtn = document.getElementById('resetBtn');
        resetBtn.addEventListener('click', () => {
            this.initArrays();
        });
    }
    
    createRipple(x, y) {
        const col = Math.floor(x / this.resolution);
        const row = Math.floor(y / this.resolution);
        
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            const index = row * this.cols + col;
            this.currentHeight[index] += this.waveStrength;
        }
    }
    
    updatePhysics() {
        // 水波物理模拟
        for (let row = 1; row < this.rows - 1; row++) {
            for (let col = 1; col < this.cols - 1; col++) {
                const index = row * this.cols + col;
                
                // 计算周围邻居的平均高度
                const neighbors = [
                    this.previousHeight[(row - 1) * this.cols + col],     // 上
                    this.previousHeight[(row + 1) * this.cols + col],     // 下
                    this.previousHeight[row * this.cols + col - 1],       // 左
                    this.previousHeight[row * this.cols + col + 1]        // 右
                ];
                
                const avgNeighborHeight = neighbors.reduce((sum, h) => sum + h, 0) / 4;
                
                // 更新当前高度（波动方程）
                const newHeight = avgNeighborHeight * 2 - this.currentHeight[index];
                this.currentHeight[index] = newHeight * this.damping;
            }
        }
        
        // 交换数组
        [this.previousHeight, this.currentHeight] = [this.currentHeight, this.previousHeight];
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        if (this.renderMode === '3d') {
            this.render3D();
        } else {
            this.render2D();
        }
    }
    
    render3D() {
        // 3D渲染模式 - 使用阴影和光照效果
        const imageData = this.ctx.createImageData(this.width, this.height);
        const data = imageData.data;
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const index = row * this.cols + col;
                const height = this.previousHeight[index];
                
                // 计算法向量（用于光照）
                const dx = (col < this.cols - 1) ? 
                    this.previousHeight[index + 1] - height : 0;
                const dy = (row < this.rows - 1) ? 
                    this.previousHeight[index + this.cols] - height : 0;
                
                // 简单的光照计算
                const lightX = 0.5;
                const lightY = -0.5;
                const lightZ = 1;
                
                const normalX = -dx / 10;
                const normalY = -dy / 10;
                const normalZ = 1;
                
                const dotProduct = normalX * lightX + normalY * lightY + normalZ * lightZ;
                const brightness = Math.max(0, Math.min(1, dotProduct));
                
                // 根据高度和光照设置颜色
                const baseColor = this.getWaterColor(height);
                const r = Math.floor(baseColor.r * brightness);
                const g = Math.floor(baseColor.g * brightness);
                const b = Math.floor(baseColor.b * brightness);
                
                // 填充像素
                for (let dy = 0; dy < this.resolution; dy++) {
                    for (let dx = 0; dx < this.resolution; dx++) {
                        const pixelX = col * this.resolution + dx;
                        const pixelY = row * this.resolution + dy;
                        const pixelIndex = (pixelY * this.width + pixelX) * 4;
                        
                        if (pixelIndex < data.length) {
                            data[pixelIndex] = r;     // R
                            data[pixelIndex + 1] = g; // G
                            data[pixelIndex + 2] = b; // B
                            data[pixelIndex + 3] = 255; // A
                        }
                    }
                }
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    render2D() {
        // 2D渲染模式 - 简单的圆形波纹
        this.ctx.fillStyle = 'rgba(30, 60, 114, 0.8)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const index = row * this.cols + col;
                const height = Math.abs(this.previousHeight[index]);
                
                if (height > 0.1) {
                    const x = col * this.resolution + this.resolution / 2;
                    const y = row * this.resolution + this.resolution / 2;
                    const radius = Math.min(height * 2, this.resolution);
                    
                    const alpha = Math.min(height / 10, 1);
                    this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
    }
    
    getWaterColor(height) {
        // 根据高度返回水的颜色
        const absHeight = Math.abs(height);
        
        if (height > 0) {
            // 波峰 - 更亮的蓝色
            const intensity = Math.min(absHeight / 10, 1);
            return {
                r: 100 + intensity * 155,
                g: 150 + intensity * 105,
                b: 255
            };
        } else {
            // 波谷 - 更深的蓝色
            const intensity = Math.min(absHeight / 10, 1);
            return {
                r: 30 + intensity * 70,
                g: 60 + intensity * 90,
                b: 114 + intensity * 141
            };
        }
    }
    
    animate() {
        this.updatePhysics();
        this.render();
        requestAnimationFrame(() => this.animate());
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('waterCanvas');
    
    // 响应式画布大小
    function resizeCanvas() {
        const container = canvas.parentElement;
        const maxWidth = Math.min(800, container.clientWidth - 40);
        const maxHeight = Math.min(600, window.innerHeight - 300);
        
        canvas.width = maxWidth;
        canvas.height = maxHeight;
        canvas.style.width = maxWidth + 'px';
        canvas.style.height = maxHeight + 'px';
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // 创建水波纹模拟实例
    const simulation = new WaterRippleSimulation(canvas);
    
    // 添加键盘快捷键
    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case 'r':
            case 'R':
                simulation.initArrays();
                break;
            case 'm':
            case 'M':
                simulation.renderMode = simulation.renderMode === '3d' ? '2d' : '3d';
                break;
        }
    });
    
    console.log('水波纹模拟器已启动！');
    console.log('快捷键:');
    console.log('- R: 重置水面');
    console.log('- M: 切换渲染模式');
});