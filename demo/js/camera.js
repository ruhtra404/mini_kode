class Camera {
    constructor(fov = 60, aspect = 1, near = 0.1, far = 1000) {
        this.position = new Vector3(0, 5, -10);
        this.target = new Vector3(0, 0, 0);
        this.up = new Vector3(0, 1, 0);
        
        this.fov = fov * Math.PI / 180;
        this.aspect = aspect;
        this.near = near;
        this.far = far;
        
        this.viewMatrix = new Matrix4();
        this.projectionMatrix = new Matrix4();
        this.viewProjectionMatrix = new Matrix4();
        
        this.followDistance = 15;
        this.followHeight = 8;
        this.smoothness = 0.1;
    }
    
    setAspectRatio(aspect) {
        this.aspect = aspect;
        this.updateProjectionMatrix();
    }
    
    updateProjectionMatrix() {
        this.projectionMatrix.identity().perspective(this.fov, this.aspect, this.near, this.far);
    }
    
    updateViewMatrix() {
        this.viewMatrix.identity().lookAt(this.position, this.target, this.up);
    }
    
    updateMatrices() {
        this.updateViewMatrix();
        this.updateProjectionMatrix();
        this.viewProjectionMatrix.copy(this.projectionMatrix).multiply(this.viewMatrix);
    }
    
    followCar(car) {
        const idealPosition = car.position
            .add(new Vector3(0, this.followHeight, 0))
            .subtract(car.forward.multiply(this.followDistance));
        
        this.position = this.position.add(idealPosition.subtract(this.position).multiply(this.smoothness));
        this.target = car.position.add(new Vector3(0, 2, 0));
        
        this.updateMatrices();
    }
    
    worldToScreen(worldPos) {
        const clipPos = this.viewProjectionMatrix.transformVector(worldPos);
        
        return {
            x: (clipPos.x + 1) * 0.5,
            y: (1 - clipPos.y) * 0.5,
            z: clipPos.z
        };
    }
}