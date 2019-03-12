//let os = require('os');

let SkySettings = function() {
  this.turbidity = 3.0;
  this.sun_x = 0;
  this.sun_y = 0.25;
  this.sun_z = -1;
};

window.onload = function() {
    
    let skySettings = new SkySettings();
    let gui = new dat.GUI();
    gui.add(skySettings, 'turbidity', 2, 16);
    gui.add(skySettings, 'sun_x', -1, 1, 0.05);
    gui.add(skySettings, 'sun_y', 0.05, 1, 0.05);
    gui.add(skySettings, 'sun_z', -1, 1, 0.05);

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
            mtl.setFloat("turbidity", skySettings.turbidity);
            mtl.setVector3("sunDir", new BABYLON.Vector3(skySettings.sun_x, skySettings.sun_y, skySettings.sun_z).normalizeToNew());
        }
        scene.render();
    });
}
