class Track {
    constructor() {
        this.width = 12;
        this.segments = [];
        this.barriers = [];
        this.checkpoints = [];
        this.startLine = null;
        
        this.generateTrack();
        this.generateBarriers();
        this.generateCheckpoints();
    }
    
    generateTrack() {
        const trackPoints = [
            new Vector3(0, 0, 0),
            new Vector3(0, 0, 50),
            new Vector3(30, 0, 80),
            new Vector3(60, 0, 80),
            new Vector3(90, 0, 50),
            new Vector3(90, 0, 0),
            new Vector3(60, 0, -30),
            new Vector3(30, 0, -30),
            new Vector3(0, 0, 0)
        ];
        
        for (let i = 0; i < trackPoints.length - 1; i++) {
            const start = trackPoints[i];
            const end = trackPoints[i + 1];
            const direction = end.subtract(start).normalize();
            const length = start.distance(end);
            
            this.segments.push({
                start: start,
                end: end,
                direction: direction,
                length: length,
                width: this.width
            });
        }
        
        this.startLine = {
            position: new Vector3(0, 0, -5),
            direction: new Vector3(0, 0, 1),
            width: this.width
        };
    }
    
    generateBarriers() {
        this.barriers = [];
        
        for (const segment of this.segments) {
            const leftBarrier = this.createBarrier(segment, -this.width / 2 - 1);
            const rightBarrier = this.createBarrier(segment, this.width / 2 + 1);
            
            this.barriers.push(leftBarrier, rightBarrier);
        }
    }
    
    createBarrier(segment, offset) {
        const perpendicular = new Vector3(-segment.direction.z, 0, segment.direction.x);
        const start = segment.start.add(perpendicular.multiply(offset));
        const end = segment.end.add(perpendicular.multiply(offset));
        
        return {
            start: start,
            end: end,
            height: 2,
            width: 0.5
        };
    }
    
    generateCheckpoints() {
        this.checkpoints = [];
        
        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const midpoint = segment.start.add(segment.end).divide(2);
            
            this.checkpoints.push({
                position: midpoint,
                width: this.width,
                passed: false,
                index: i
            });
        }
    }
    
    getTrackBounds() {
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        for (const segment of this.segments) {
            minX = Math.min(minX, segment.start.x, segment.end.x);
            maxX = Math.max(maxX, segment.start.x, segment.end.x);
            minZ = Math.min(minZ, segment.start.z, segment.end.z);
            maxZ = Math.max(maxZ, segment.start.z, segment.end.z);
        }
        
        return { minX, maxX, minZ, maxZ };
    }
    
    getTrackWidthAt(position) {
        return this.width;
    }
    
    getNearestTrackPoint(position) {
        let nearestPoint = null;
        let minDistance = Infinity;
        
        for (const segment of this.segments) {
            const point = this.getClosestPointOnSegment(position, segment);
            const distance = position.distance(point);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = point;
            }
        }
        
        return { point: nearestPoint, distance: minDistance };
    }
    
    getClosestPointOnSegment(point, segment) {
        const toStart = point.subtract(segment.start);
        const toEnd = segment.end.subtract(segment.start);
        
        const t = Math.max(0, Math.min(1, toStart.dot(toEnd) / toEnd.dot(toEnd)));
        
        return segment.start.add(toEnd.multiply(t));
    }
    
    isOnTrack(position) {
        const trackInfo = this.getNearestTrackPoint(position);
        return trackInfo.distance <= this.width / 2;
    }
    
    checkCollision(position, radius = 1) {
        for (const barrier of this.barriers) {
            if (this.checkBarrierCollision(position, barrier, radius)) {
                return true;
            }
        }
        return false;
    }
    
    checkBarrierCollision(position, barrier, radius) {
        const closestPoint = this.getClosestPointOnSegment(position, {
            start: barrier.start,
            end: barrier.end
        });
        
        return position.distance(closestPoint) < radius + barrier.width;
    }
    
    resetCheckpoints() {
        for (const checkpoint of this.checkpoints) {
            checkpoint.passed = false;
        }
    }
    
    checkLapComplete(carPosition) {
        if (!this.startLine) return false;
        
        const distanceToStart = carPosition.distance(this.startLine.position);
        
        if (distanceToStart < 5) {
            const allPassed = this.checkpoints.every(cp => cp.passed);
            
            if (allPassed) {
                this.resetCheckpoints();
                return true;
            }
        }
        
        return false;
    }
    
    updateCheckpoints(carPosition) {
        for (const checkpoint of this.checkpoints) {
            if (!checkpoint.passed) {
                const distance = carPosition.distance(checkpoint.position);
                if (distance < 8) {
                    checkpoint.passed = true;
                }
            }
        }
    }
}