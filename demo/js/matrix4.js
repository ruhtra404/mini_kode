class Matrix4 {
    constructor() {
        this.elements = [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
    }
    
    identity() {
        this.elements = [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
        return this;
    }
    
    copy(m) {
        this.elements = m.elements.slice();
        return this;
    }
    
    multiply(m) {
        const a = this.elements;
        const b = m.elements;
        const result = new Array(16);
        
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                result[i * 4 + j] = 0;
                for (let k = 0; k < 4; k++) {
                    result[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
                }
            }
        }
        
        this.elements = result;
        return this;
    }
    
    translate(x, y, z) {
        const translation = new Matrix4();
        translation.elements[12] = x;
        translation.elements[13] = y;
        translation.elements[14] = z;
        return this.multiply(translation);
    }
    
    rotateX(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotation = new Matrix4();
        rotation.elements[5] = cos;
        rotation.elements[6] = -sin;
        rotation.elements[9] = sin;
        rotation.elements[10] = cos;
        return this.multiply(rotation);
    }
    
    rotateY(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotation = new Matrix4();
        rotation.elements[0] = cos;
        rotation.elements[2] = sin;
        rotation.elements[8] = -sin;
        rotation.elements[10] = cos;
        return this.multiply(rotation);
    }
    
    rotateZ(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotation = new Matrix4();
        rotation.elements[0] = cos;
        rotation.elements[1] = -sin;
        rotation.elements[4] = sin;
        rotation.elements[5] = cos;
        return this.multiply(rotation);
    }
    
    scale(x, y, z) {
        const scaling = new Matrix4();
        scaling.elements[0] = x;
        scaling.elements[5] = y;
        scaling.elements[10] = z;
        return this.multiply(scaling);
    }
    
    perspective(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov / 2);
        const rangeInv = 1 / (near - far);
        
        this.elements = [
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (near + far) * rangeInv, -1,
            0, 0, near * far * rangeInv * 2, 0
        ];
        return this;
    }
    
    lookAt(eye, center, up) {
        const f = center.subtract(eye).normalize();
        const s = f.cross(up).normalize();
        const u = s.cross(f);
        
        this.elements = [
            s.x, u.x, -f.x, 0,
            s.y, u.y, -f.y, 0,
            s.z, u.z, -f.z, 0,
            -s.dot(eye), -u.dot(eye), f.dot(eye), 1
        ];
        return this;
    }
    
    transformVector(v) {
        const x = v.x * this.elements[0] + v.y * this.elements[4] + v.z * this.elements[8] + this.elements[12];
        const y = v.x * this.elements[1] + v.y * this.elements[5] + v.z * this.elements[9] + this.elements[13];
        const z = v.x * this.elements[2] + v.y * this.elements[6] + v.z * this.elements[10] + this.elements[14];
        const w = v.x * this.elements[3] + v.y * this.elements[7] + v.z * this.elements[11] + this.elements[15];
        
        return new Vector3(x / w, y / w, z / w);
    }
}