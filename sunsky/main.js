//let os = require('os');

let SkySettings = function() {
    this.turbidity = 3.0;
    this.sun_x = 0;
    this.sun_y = 0.25;
    this.sun_z = -1;

    // https://www.desmos.com/calculator/gslcdxvipg
    this.tm_P = 20.0;  // max display brightness
    this.tm_a = 0.33;  // contrast
    this.tm_m = 0.22; // linear section start
    this.tm_l = 0.4;  // linear section length
    this.tm_c = 1.33; // black
    this.tm_b = 0.0;  // pedestal
};

window.onload = function() {
    
    let skySettings = new SkySettings();
    let gui = new dat.GUI();
    let f1 = gui.addFolder('Sun');
    f1.add(skySettings, 'turbidity', 2, 16);
    f1.add(skySettings, 'sun_x', -1, 1, 0.05);
    f1.add(skySettings, 'sun_y', 0.05, 1, 0.05);
    f1.add(skySettings, 'sun_z', -1, 1, 0.05);
    f1.open();
    let f2 = gui.addFolder('Tonemapping');
    f2.add(skySettings, 'tm_P', 10, 50);
    f2.add(skySettings, 'tm_a', 0.0, 1.0);
    f2.add(skySettings, 'tm_m', 0.0, 1.0);
    f2.add(skySettings, 'tm_l', 0.0, 1.0);
    f2.add(skySettings, 'tm_c', 0.0, 2.0);
    f2.add(skySettings, 'tm_b');
    f2.open();

    let canvas = document.getElementById('babylon_canvas');
    let engine = new BABYLON.Engine(canvas, true);
    console.log(`WebGL version ${engine.webGLVersion}`);

    let createScene = function () {
        let scene = new BABYLON.Scene(engine);

        // Adding a light
        let light = new BABYLON.HemisphericLight();

        // Adding an Arc Rotate Camera
        let camera = new BABYLON.ArcRotateCamera("Camera", 1.570796, 1.570796, 500, BABYLON.Vector3.Zero(), scene);
        camera.attachControl(canvas, false);

        // Import meshes
        BABYLON.SceneLoader.Append("./content/buster_drone/", "scene.gltf", scene, function (loaded) {
            
            console.log(`Loaded ${loaded.meshes.length} meshes`);
            //console.log(scene);

            for(let i = 0; i < loaded.meshes.length; ++i)
            {
                let srcMaterial = loaded.meshes[i].material;
                if (srcMaterial)
                {
                    //console.log(`${i}, ${srcMaterial.albedoTexture}`);
                    let objMaterial = shaderCustomVisualize.create(scene);
                    objMaterial.setTexture("textureSampler", srcMaterial.albedoTexture);

                    loaded.meshes[i].material = objMaterial;
                }
            }

            // Add skybox
            let skyMaterial = shaderCustomSkybox.create(scene);
            let skybox = BABYLON.Mesh.CreateBox("skyBox", 10000.0, scene);
            skybox.material = skyMaterial;

            scene.skybox = skybox;
        });

        return scene;
    }

    let scene = createScene();
    
    engine.runRenderLoop(function() {

        if (scene.skybox)
        {
            let mtl = scene.skybox.material;
            let sunDir = new BABYLON.Vector3(skySettings.sun_x, skySettings.sun_y, skySettings.sun_z).normalizeToNew();
            let tm0 = new BABYLON.Vector4(
                skySettings.tm_P,
                skySettings.tm_a,
                skySettings.tm_m,
                skySettings.tm_l);
            let tm1 = new BABYLON.Vector4(
                skySettings.tm_c,
                skySettings.tm_b,
                0.0,
                0.0);
            mtl.setFloat("turbidity", skySettings.turbidity);
            mtl.setVector3("sunDir", sunDir);
            mtl.setVector4("tonemapping0", tm0);
            mtl.setVector4("tonemapping1", tm1);
        }
        scene.render();
    });
}
