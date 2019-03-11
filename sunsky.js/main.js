//let os = require('os');

let SkySettings = function() {
  this.turbidity = 3.0;
  this.time = 0;
};

window.onload = function() {
    
    let skySettings = new SkySettings();
    let gui = new dat.GUI();
    gui.add(skySettings, 'turbidity', 1, 16);
    gui.add(skySettings, 'time', 0, 359);

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
            scene.skybox.material.setFloat("time", -(skySettings.time / 180.0) * 3.1415926);
            scene.skybox.material.setFloat("turbidity", skySettings.turbidity);
        }
        scene.render();
    });
}