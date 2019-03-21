//let os = require('os');

let SkySettings = function() {
    this.turbidity = 2.2;
    this.sun_x = -0.75;
    this.sun_y = 1.0;
    this.sun_z = -1;
    this.sun_brightness = 0.25;
    
    // https://www.desmos.com/calculator/gslcdxvipg
    this.tm_P = 12.0;  // max display brightness
    this.tm_P_r = 1.0;  // max display brightness red scalar
    this.tm_P_g = 1.0;  // max display brightness green scalar
    this.tm_P_b = 1.2;  // max display brightness blue scalar
    this.tm_a = 0.35;  // contrast
    this.tm_m = 0.22; // linear section start
    this.tm_l = 0.4;  // linear section length
    this.tm_c = 1.33; // black
    this.pp_tonemapping = true;
    //this.tm_b = 0.0;  // pedestal

    this.cloudscale = 0.001;
    this.cloudspeed = 0.0;//0.02;
    this.clouddark = 0.5;
    this.cloudlight = 0.6;
    this.cloudskytint = 1.0;

    this.init_gui = function() {
        let gui = new dat.GUI();
        let f1 = gui.addFolder('Sun');
        f1.add(this, 'turbidity', 2, 6, 0.1);
        f1.add(this, 'sun_x', -1, 1, 0.05);
        f1.add(this, 'sun_y', 0.05, 1, 0.05);
        f1.add(this, 'sun_z', -1, 1, 0.05);
        f1.add(this, 'sun_brightness', 0.0, 2.0, 0.05);
        f1.open();
        
        let f2 = gui.addFolder('Sky Color Control');
        f2.add(this, 'tm_P_r', 0, 2, 0.01);
        f2.add(this, 'tm_P_g', 0, 2, 0.01);
        f2.add(this, 'tm_P_b', 0, 2, 0.01);
        //f2.open();

        let f3 = gui.addFolder('Sky Tonemapping');
        f3.add(this, 'tm_P', 2, 50);
        f3.add(this, 'tm_a', 0.0, 1.0);
        f3.add(this, 'tm_m', 0.0, 1.0);
        f3.add(this, 'tm_l', 0.0, 1.0);
        f3.add(this, 'tm_c', 0.0, 5.0);
        //f3.open();

        let f4 = gui.addFolder('Cloud');
        f4.add(this, 'cloudscale', 0, 0.01, 0.0001);
        f4.add(this, 'cloudspeed', 0, 0.1, 0.001);
        f4.add(this, 'clouddark', 0, 1.0, 0.01);
        f4.add(this, 'cloudlight', 0, 1.0, 0.01);
        f4.add(this, 'cloudskytint', 0, 1.0, 0.01);
        f4.open();

        let f5 = gui.addFolder('Post Process');
        f5.add(this, 'pp_tonemapping');
        //f5.open();

        return gui;
    }
};

window.onload = function() {
    
    let skySettings = new SkySettings();
    skySettings.init_gui();
    
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

        // Add skybox
        let skyMaterial = shaderCustomSkybox.create(scene);
        let skybox = BABYLON.Mesh.CreateBox("skyBox", 5000.0, scene);
        skybox.material = skyMaterial;

        scene.skybox = skybox;

        let probe = new BABYLON.ReflectionProbe("Probe", 256, scene, true, true);
        probe.renderList.push(skybox);

        // Add cloud layer
        let cloudMaterial = shaderCloud.create(scene);
        cloudMaterial.setTexture("skyTextureSampler", probe.cubeTexture);
        let cloudLayer = BABYLON.Mesh.CreateBox("cloudLayer", 10000.0, scene);
        cloudLayer.material = cloudMaterial;
        //cloudLayer.position.y = 500;
        //cloudLayer.rotation.x = 1.570796;
        scene.cloudLayer = cloudLayer;

        // this is god damn important for using RenderTargetTexture in ShaderMaterial
        scene.customRenderTargets.push(probe.cubeTexture);

        // Import meshes
        BABYLON.SceneLoader.Append("./content/buster_drone/", "scene.gltf", scene, function (loaded) {
            
            console.log(`Loaded ${loaded.meshes.length} meshes`);
            //console.log(scene);

            // Skip skybox & cloud
            for(let i = 2; i < loaded.meshes.length; ++i)
            {
                let srcMaterial = loaded.meshes[i].material;
                if (srcMaterial)
                {
                    //console.log(`${i}, ${srcMaterial.albedoTexture}`);
                    let objMaterial = shaderCustomVisualize.create(scene);
                    objMaterial.setTexture("baseTextureSampler", srcMaterial.albedoTexture);
                    objMaterial.setTexture("skyTextureSampler", probe.cubeTexture);
                    loaded.meshes[i].material = objMaterial;
                }
            }
        });

        let pipeline = new BABYLON.DefaultRenderingPipeline(
            "default", // The name of the pipeline
            true, // Do you want HDR textures ?
            scene, // The scene instance
            [camera] // The list of cameras to be attached to
        );

        pipeline.imageProcessingEnabled = false;

        let gt_tonemapping = shaderUchimuraTonemapping.createPostProcess(camera);
        gt_tonemapping.onApply = function (effect) {
            effect.setFloat("enabled", skySettings.pp_tonemapping ? 1.0 : 0.0);
            effect.setFloat("param_P", skySettings.tm_P * 0.5);
        };

        /*
        let gt_tonemappingRenderEffect = new BABYLON.PostProcessRenderEffect(engine, "UchimuraTonemapping", function() { return [gt_tonemapping] });
        pipeline.addEffect(gt_tonemappingRenderEffect);

        scene.postProcessRenderPipelineManager.addPipeline(pipeline);
        scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("default", camera);
        */
       
        scene.pipeline = pipeline;

        return scene;
    }

    let scene = createScene();
    let time  = 0.0;
    
    engine.runRenderLoop(function() {

        let sunDir = new BABYLON.Vector3(skySettings.sun_x, skySettings.sun_y, skySettings.sun_z).normalizeToNew();
        let viewPos = scene.activeCamera.position;
        
        if (scene.skybox)
        {
            let mtl = scene.skybox.material;
            
            let sunParams = new BABYLON.Vector4(skySettings.sun_brightness, 0.0, 0.0, 0.0);
            let tm0 = new BABYLON.Vector4(
                skySettings.tm_P,
                skySettings.tm_a,
                skySettings.tm_m,
                skySettings.tm_l);
            let tm1 = new BABYLON.Vector4(
                skySettings.tm_c,
                skySettings.tm_P_r,
                skySettings.tm_P_g,
                skySettings.tm_P_b);
            mtl.setFloat("turbidity", skySettings.turbidity);
            mtl.setVector3("sunDir", sunDir);
            mtl.setVector4("sunParams", sunParams);
            mtl.setVector4("tonemapping0", tm0);
            mtl.setVector4("tonemapping1", tm1);
        }

        if (scene.cloudLayer)
        {
            let mtl = scene.cloudLayer.material;
            
            mtl.setFloat("iTime", time);
            mtl.setFloat("cloudscale", skySettings.cloudscale);
            mtl.setFloat("cloudspeed", skySettings.cloudspeed);
            mtl.setFloat("cloudlight", skySettings.cloudlight);
            mtl.setFloat("clouddark", skySettings.clouddark);
            mtl.setFloat("cloudskytint", skySettings.cloudskytint);
            mtl.setVector3("sunDir", sunDir);
            mtl.setVector3("viewPos", viewPos);
        }

        scene.render();

        time = time + 0.01667;
    });
}
