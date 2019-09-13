
class ExampleFSOFScene {
    constructor(target, file) {
        this.renderer = null;
        this.camera = null;
        this.scene = null;
        this.ambient = null;
        this.dir = null;
        this.object = null;
        this.lastSize = [0, 0];

        this.container = target;
        this.init(target, file);

        this.initDragDrop(target);
    }

    initDragDrop(target) {
        target.addEventListener("dragover", function( event ) {
            event.preventDefault();
        }, false);

        target.addEventListener('drop', (event) => {
            event.preventDefault();
            if (event.dataTransfer.items) {
                // Use DataTransferItemList interface to access the file(s)
                for (var i = 0; i < event.dataTransfer.items.length; i++) {
                    // If dropped items aren't files, reject them
                    if (event.dataTransfer.items[i].kind === 'file') {
                        var file = event.dataTransfer.items[i].getAsFile();
                        this.loadModel(URL.createObjectURL(file));
                    }
                }
            } else {
                // Use DataTransfer interface to access the file(s)
                for (var i = 0; i < event.dataTransfer.files.length; i++) {
                    this.loadModel(URL.createObjectURL(event.dataTransfer.files[i]));
                }
            }
        }, false);
    }

    init(target, file) {
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(new THREE.Color("rgba(230,240,255,1.0)"));
        this.renderer.gammaInput = true;
        this.renderer.gammaFactor = 2.2;
        this.renderer.gammaOutput = true;
        this.renderer.shadowMap.enabled = true;
        let domElement = this.renderer.domElement;
        target.appendChild(domElement);

        THREE.FSOFCheckSupport(this.renderer);

        this.camera = new THREE.PerspectiveCamera(45, domElement.clientWidth/domElement.clientHeight, 1, 1000);
        this.camera.position.z = 3;

        this.scene = new THREE.Scene();

        this.ambient = new THREE.AmbientLight(0xd0e0ff, 0.5);
        this.scene.add(this.ambient);

        let light = new THREE.DirectionalLight( 0xffffff );
        light.position.set(-75, 200, -75);
        light.castShadow = true;
        light.shadow.camera.top = 0;
        light.shadow.camera.bottom = -75;
        light.shadow.camera.left = -50;
        light.shadow.camera.right = 50;
        light.shadow.bias = -0.001;
        this.scene.add(light);
        this.dir = light;

        let groundMaterial = new THREE.ShadowMaterial();
        groundMaterial.opacity = 0.3;

        let planeGeometry = new THREE.PlaneBufferGeometry( 100, 100 );
        let ground = new THREE.Mesh( planeGeometry, groundMaterial );
        ground.position.set(0, -1, 0);
        ground.rotation.x = -Math.PI / 2;
        ground.scale.set(1000, 1000, 1000);
        ground.receiveShadow = true;
        this.scene.add(ground);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;
        this.controls.enableZoom = false;

        this.loadModel(file);
        this.render();
    }

    loadModel(file) {
        let loader = new THREE.FSOFLoader();
        loader.load(file, (object) => {
            if (this.object != null) {
                this.scene.remove(this.object);
            }

            let bbox = new THREE.Box3().setFromObject(object);
            let ctr = bbox.getCenter();
            let dist = bbox.getSize().length();

            this.controls.target = ctr;
            this.camera.position.set(dist * 1, dist * 1, dist * 1);
            this.controls.update();
            this.scene.add(object);
            this.object = object;
        });
    }

    resize(size) {
        this.renderer.setSize(size[0], size[1]);
        this.camera.aspect = size[0] / size[1];
        this.camera.updateProjectionMatrix();
        this.lastSize = size;
    }

    render() {
        let size = [this.container.clientWidth, this.container.clientHeight];
        if (size[0] != this.lastSize[0] || size[1] != this.lastSize[1]) {
            this.resize(size);
        }

        requestAnimationFrame(this.render.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

window['ExampleFSOFScene'] = ExampleFSOFScene;