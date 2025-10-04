class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        this.camera = new Camera(60, this.width / this.height, 0.1, 1000);
        this.camera.position = new Vector3(0, 15, -20);
        
        this.debugMode = false;
        this.wireframe = false;
    }
    
    setSize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
        this.camera.setAspectRatio(width / height);
    }
    
    clear() {
        this.ctx.fillStyle = '#87CEEB'; // Sky blue
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw ground
        this.ctx.fillStyle = '#228B22'; // Forest green
        this.ctx.fillRect(0, this.height * 0.7, this.width, this.height * 0.3);
    }
    
    render(car, track) {
        this.clear();
        
        // Update camera to follow car
        this.camera.followCar(car);
        
        // Render track
        this.renderTrack(track);
        
        // Render car
        this.renderCar(car);
        
        // Render UI elements
        this.renderUI(car, track);
        
        if (this.debugMode) {
            this.renderDebugInfo(car, track);
        }
    }
    
    renderTrack(track) {
        // Render track surface
        for (const segment of track.segments) {
            this.renderTrackSegment(segment);
        }
        
        // Render barriers
        for (const barrier of track.barriers) {
            this.renderBarrier(barrier);
        }
        
        // Render checkpoints
        for (const checkpoint of track.checkpoints) {
            if (!checkpoint.passed) {
                this.renderCheckpoint(checkpoint);
            }
        }
        
        // Render start line
        if (track.startLine) {
            this.renderStartLine(track.startLine);
        }
    }
    
    renderTrackSegment(segment) {
        const perpendicular = new Vector3(-segment.direction.z, 0, segment.direction.x);
        const halfWidth = segment.width / 2;
        
        const corners = [
            segment.start.add(perpendicular.multiply(-halfWidth)),
            segment.start.add(perpendicular.multiply(halfWidth)),
            segment.end.add(perpendicular.multiply(halfWidth)),
            segment.end.add(perpendicular.multiply(-halfWidth))
        ];
        
        const screenCorners = corners.map(corner => 
            this.camera.worldToScreen(corner)
        );
        
        // Only render if at least some corners are visible
        if (screenCorners.some(corner => corner.z > 0 && corner.z < 1)) {
            this.ctx.fillStyle = '#404040'; // Dark gray track
            this.ctx.strokeStyle = '#FFFF00'; // Yellow lines
            this.ctx.lineWidth = 2;
            
            this.ctx.beginPath();
            this.ctx.moveTo(screenCorners[0].x * this.width, screenCorners[0].y * this.height);
            for (let i = 1; i < screenCorners.length; i++) {
                this.ctx.lineTo(screenCorners[i].x * this.width, screenCorners[i].y * this.height);
            }
            this.ctx.closePath();
            
            if (this.wireframe) {
                this.ctx.stroke();
            } else {
                this.ctx.fill();
                this.ctx.stroke();
            }
        }
    }
    
    renderBarrier(barrier) {
        const screenStart = this.camera.worldToScreen(barrier.start);
        const screenEnd = this.camera.worldToScreen(barrier.end);
        
        if (screenStart.z > 0 && screenStart.z < 1 && screenEnd.z > 0 && screenEnd.z < 1) {
            this.ctx.strokeStyle = '#FF0000'; // Red barriers
            this.ctx.lineWidth = 8;
            
            this.ctx.beginPath();
            this.ctx.moveTo(screenStart.x * this.width, screenStart.y * this.height);
            this.ctx.lineTo(screenEnd.x * this.width, screenEnd.y * this.height);
            this.ctx.stroke();
        }
    }
    
    renderCheckpoint(checkpoint) {
        const screenPos = this.camera.worldToScreen(checkpoint.position);
        
        if (screenPos.z > 0 && screenPos.z < 1) {
            const size = 20 / screenPos.z; // Size decreases with distance
            
            this.ctx.strokeStyle = '#00FF00'; // Green checkpoints
            this.ctx.lineWidth = 3;
            
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x * this.width, screenPos.y * this.height, size, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Checkpoint number
            this.ctx.fillStyle = '#00FF00';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText((checkpoint.index + 1).toString(), screenPos.x * this.width, screenPos.y * this.height);
        }
    }
    
    renderStartLine(startLine) {
        const perpendicular = new Vector3(-startLine.direction.z, 0, startLine.direction.x);
        const halfWidth = startLine.width / 2;
        
        const start1 = startLine.position.add(perpendicular.multiply(-halfWidth));
        const start2 = startLine.position.add(perpendicular.multiply(halfWidth));
        
        const screen1 = this.camera.worldToScreen(start1);
        const screen2 = this.camera.worldToScreen(start2);
        
        if (screen1.z > 0 && screen1.z < 1 && screen2.z > 0 && screen2.z < 1) {
            this.ctx.strokeStyle = '#FFFFFF'; // White start line
            this.ctx.lineWidth = 4;
            
            this.ctx.beginPath();
            this.ctx.moveTo(screen1.x * this.width, screen1.y * this.height);
            this.ctx.lineTo(screen2.x * this.width, screen2.y * this.height);
            this.ctx.stroke();
        }
    }
    
    renderCar(car) {
        const corners = car.getCorners();
        const screenCorners = corners.map(corner => 
            this.camera.worldToScreen(corner)
        );
        
        // Only render if visible
        if (screenCorners.some(corner => corner.z > 0 && corner.z < 1)) {
            // Car body
            this.ctx.fillStyle = car.color;
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
            
            this.ctx.beginPath();
            this.ctx.moveTo(screenCorners[0].x * this.width, screenCorners[0].y * this.height);
            for (let i = 1; i < screenCorners.length; i++) {
                this.ctx.lineTo(screenCorners[i].x * this.width, screenCorners[i].y * this.height);
            }
            this.ctx.closePath();
            
            if (this.wireframe) {
                this.ctx.stroke();
            } else {
                this.ctx.fill();
                this.ctx.stroke();
            }
            
            // Wheels (simplified as circles)
            this.renderWheels(car);
            
            // Direction indicator
            this.renderDirectionIndicator(car);
        }
    }
    
    renderWheels(car) {
        const wheelPositions = [
            car.position.add(car.right.multiply(-1.2)).add(car.forward.multiply(-1.5)),
            car.position.add(car.right.multiply(1.2)).add(car.forward.multiply(-1.5)),
            car.position.add(car.right.multiply(-1.2)).add(car.forward.multiply(1.5)),
            car.position.add(car.right.multiply(1.2)).add(car.forward.multiply(1.5))
        ];
        
        this.ctx.fillStyle = '#202020';
        
        for (const wheelPos of wheelPositions) {
            const screenWheel = this.camera.worldToScreen(wheelPos);
            
            if (screenWheel.z > 0 && screenWheel.z < 1) {
                const size = 8 / screenWheel.z;
                
                this.ctx.beginPath();
                this.ctx.arc(screenWheel.x * this.width, screenWheel.y * this.height, size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }
    
    renderDirectionIndicator(car) {
        const frontPos = car.position.add(car.forward.multiply(3));
        const screenFront = this.camera.worldToScreen(frontPos);
        const screenCar = this.camera.worldToScreen(car.position);
        
        if (screenFront.z > 0 && screenCar.z > 0) {
            this.ctx.strokeStyle = '#FFFF00';
            this.ctx.lineWidth = 2;
            
            this.ctx.beginPath();
            this.ctx.moveTo(screenCar.x * this.width, screenCar.y * this.height);
            this.ctx.lineTo(screenFront.x * this.width, screenFront.y * this.height);
            this.ctx.stroke();
        }
    }
    
    renderUI(car, track) {
        // Speed indicator
        const speed = car.getSpeedKMH();
        const speedElement = document.getElementById('speed');
        if (speedElement) {
            speedElement.textContent = Math.round(speed);
        }
    }
    
    renderDebugInfo(car, track) {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'left';
        
        const debugInfo = [
            `Position: ${car.position.toString()}`,
            `Speed: ${car.getSpeedKMH().toFixed(1)} km/h`,
            `On Track: ${track.isOnTrack(car.position)}`,
            `Camera: ${this.camera.position.toString()}`,
            `FPS: ${Math.round(1000 / 16)}` // Placeholder
        ];
        
        for (let i = 0; i < debugInfo.length; i++) {
            this.ctx.fillText(debugInfo[i], 10, 20 + i * 12);
        }
    }
    
    toggleDebug() {
        this.debugMode = !this.debugMode;
    }
    
    toggleWireframe() {
        this.wireframe = !this.wireframe;
    }
}