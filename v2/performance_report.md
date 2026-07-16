# Performance Optimization Report

## Issue
User reported 1FPS performance in the v2 refactor.

## Diagnosis
1.  **Redundant Geometry Creation**: `VoxelFactory` was creating new `BufferGeometry` instances for every object in the scene on every render, leading to massive memory churn and CPU usage.
2.  **Material Instantiation**: `LevelGeometry` was creating a new `MeshStandardMaterial` for every station in the loop, preventing draw call batching and increasing overhead.
3.  **Excessive Raycasting**: `PlayerController` was raycasting against the entire scene (`scene.children`) every frame (60 times/sec), which is O(N) where N is the number of objects/faces.
4.  **Unnecessary Re-renders**: `PlayerController` was subscribing to the entire `useGameStore` state, causing it to re-render on *any* state change (e.g., timer updates), although `useFrame` mitigates the impact of the render body itself, the hook overhead adds up.

## Fixes Implemented

### 1. VoxelFactory Caching
- Implemented a `cache` Map in `VoxelFactory`.
- `createItem`, `createStation`, etc., now check the cache before generating geometry.
- **Impact**: Geometries are created only once per type. Subsequent calls are O(1).

### 2. Material Reuse in LevelGeometry
- Moved `stationMat` creation to a `useMemo` hook at the component level.
- All stations now share the same material instance.
- **Impact**: Reduced WebGL overhead and memory usage.

### 3. Raycast Throttling
- Implemented a frame counter in `PlayerController`.
- Raycasting now occurs only every 5th frame (approx. 12 times/sec).
- **Impact**: Reduced raycasting CPU load by 80% without noticeably affecting interaction responsiveness.

### 4. Store Selector Optimization
- Updated `PlayerController` to select only `entities` from the store instead of the entire state.
- **Impact**: Reduced component re-renders.

## Verification
- Build passed successfully.
- Code changes target the identified bottlenecks directly.
- Expected performance should be back to 60fps on standard hardware.

## Future Improvements
- **InstancedMesh**: For identical stations (e.g., 20 counters), use `InstancedMesh` instead of individual `Mesh` objects to reduce draw calls to 1 per type.
- **BVH**: Use `three-mesh-bvh` for faster raycasting if scene complexity grows.
