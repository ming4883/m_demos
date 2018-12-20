
let canvas, ctx, p2WorldDisabled, p2WorldActive, p2PlaneBody;

let seeds, voronoi, cellBodies;
let CELL_SIZE = 20.0;
let CELL_MASS = 1.0;
let CELL_OMEGA = 1.0;

function initCellBody(cellIndex, position, scale, mass, angularVelocity) {

    let vertices = [];

    let vorPoly = voronoi.cellPolygon(cellIndex);
    
    let x_ = 0.0, y_ = 0.0;

    for(let p = 0; p < (vorPoly.length - 1); ++p)
    {
        let x = vorPoly[p][0] - seeds[cellIndex][0];
        let y = vorPoly[p][1] - seeds[cellIndex][1];

        // prevent duplicated vertices
        let dx = x - x_;
        let dy = y - y_;
        if ((p == 0) || (dx*dx + dy*dy > 0.1))
        {
            if (p > 0)
            {
                let dx = x - vertices[0][0];
                let dy = y - vertices[0][1];

                if (dx*dx + dy*dy < 0.1)
                    continue;
            }
            vertices.push([x * scale, y * scale]);
            x_ = x;
            y_ = y;
        }
    }

    let cellShape = new p2.Convex({ vertices: vertices });
    let cellBody = new p2.Body({ position:position, mass:mass, angularVelocity:angularVelocity });

    cellBody.addShape(cellShape);

    return cellBody;
}

function initCells(cellSize, cellCount, cellOffset) {
    seeds = [];

    for(let x = 0; x < cellCount; ++x)
    {
        for(let y = 0; y < cellCount; ++y)
        {
            let s = (Math.random() * 2.0 - 1.0) * cellSize * 0.25;
            let t = (Math.random() * 2.0 - 1.0) * cellSize * 0.25;

            seeds.push([(x+0.5) * cellSize + s, (y+0.5) * cellSize + t]);
        }
    }
    let cellBound = cellSize * cellCount;

    voronoi = d3.Delaunay.from(seeds).voronoi([0, 0, cellBound, cellBound]);

    cellBodies = [];

    for(let i = 0; i < seeds.length; ++i)
    {
        let cellPos = [seeds[i][0] + cellOffset[0], seeds[i][1] + cellOffset[1]];

        let cellBody = initCellBody(i, cellPos, 1.0, 0, 0);

        p2WorldActive.addBody(cellBody);
        cellBodies.push(cellBody);
    }
}

// Convert a canvas coordiante to physics coordinate
function getPhysicsCoord(mouseEvent) {
    var rect = canvas.getBoundingClientRect();
    var x = mouseEvent.clientX - rect.left;
    var y = mouseEvent.clientY - rect.top;

    let scaleX = 1.0;
    let scaleY = -1.0;

    x = (x - canvas.width / 2) / scaleX;
    y = (y - canvas.height / 2) / scaleY;

    return [x, y];
}

function init() {

    // Init canvas
    canvas = document.getElementById("main");
    ctx = canvas.getContext("2d");
    ctx.lineWidth = 0.5;//0.05;

    canvas.addEventListener('mousedown', function(event){

        // Convert the canvas coordinate to physics coordinates
        let position = getPhysicsCoord(event);

        // Check if the cursor is inside the any cell
        let hitBodies = p2WorldActive.hitTest(position, cellBodies);

        if (hitBodies.length) {
            let hit = hitBodies[0];

            let cellIndex = cellBodies.indexOf(hit);
            if (cellIndex >= 0) {
                p2WorldActive.removeBody(hit);

                let angularScale = Math.random() * 2.0 - 1.0;
                let newCellBody = initCellBody(cellIndex, hit.position, 0.875, CELL_MASS, CELL_OMEGA * angularScale);

                p2WorldActive.addBody(newCellBody);
                cellBodies[cellIndex] = newCellBody;
            }
            else {
                console.log("cell Index not found!");
            }
        }
        else {
            console.log("Hitting nothing at [" + event.clientX + ", " + event.clientY + "]!");
        }
    });

    // Init p2.js
    p2WorldActive = new p2.World();
    p2WorldDisabled = new p2.World();

    // Add a plane
    let planeShape = new p2.Plane();
    p2PlaneBody = new p2.Body({position:[0,-100]});
    p2PlaneBody.addShape(planeShape);
    p2WorldActive.addBody(p2PlaneBody);

    initCells(CELL_SIZE, 5, [50, 100]);
}

function drawbox(box) {
    let shape = box.shapes[0];

    ctx.beginPath();
    var x = box.position[0],
        y = box.position[1];
    ctx.save();
    ctx.translate(x, y);        // Translate to the center of the box
    ctx.rotate(box.angle);  // Rotate to the box body frame
    ctx.rect(-shape.width/2, -shape.height/2, shape.width, shape.height);
    ctx.stroke();
    ctx.restore();
}

function drawPlane() {
    ctx.beginPath();
    var y = p2PlaneBody.position[1];
    ctx.moveTo(-canvas.width, y);
    ctx.lineTo( canvas.width, y);
    ctx.stroke();
}

function drawCells(cellSize) {

    for(let i = 0; i < seeds.length; ++i)
    {
        let cellBody = cellBodies[i];

        ctx.beginPath();
        ctx.save();
        ctx.strokeStyle = '#ff0000'
        let x = cellBody.position[0],
            y = cellBody.position[1];
        ctx.translate(x, y);        // Translate to the center of the box
        ctx.rotate(cellBody.angle);  // Rotate to the box body frame
        
        let vorPoly = voronoi.cellPolygon(i);
        x = vorPoly[0][0] - seeds[i][0];
        y = vorPoly[0][1] - seeds[i][1];
        ctx.moveTo(x, y);
        
        for(let p = 1; p < vorPoly.length; ++p)
        {
            x = vorPoly[p][0] - seeds[i][0];
            y = vorPoly[p][1] - seeds[i][1];
            ctx.lineTo(x, y);
        }
        
        ctx.stroke();
        ctx.restore();
    }
}

function render() {
    // Clear the canvas
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Transform the canvas
    // Note that we need to flip the y axis since Canvas pixel coordinates
    // goes from top to bottom, while physics does the opposite.
    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);  // Translate to the center
    ctx.scale(1, -1);       // Zoom in and flip y axis

    // Draw all bodies
    drawCells(CELL_SIZE);
    drawPlane();

    // Restore transform
    ctx.restore();
}

// Animation loop
function animate(){
    requestAnimationFrame(animate);

    // Move physics bodies forward in time
    p2WorldActive.step(1/60);
    p2WorldDisabled.step(1/60);

    // Render scene
    render();
}

window.onload = function() {
    init();
    animate();
}